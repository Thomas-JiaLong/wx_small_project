/**
 * ============================================
 *  order - 订单管理云函数
 * ============================================
 * 
 * 功能列表：
 * 1. create     - 创建订单（包含扣款）
 * 2. getlist    - 获取订单列表
 * 3. getdetail  - 获取订单详情
 * 4. ship       - 卖家发货
 * 5. cancel     - 取消订单
 * 
 * 【重要】订单状态说明：
 * 0 - 未知
 * 1 - 待发货（买家已付款）
 * 2 - 已发货（卖家已发货）
 * 3 - 已完成（买家确认收货）
 * 4 - 已取消（手动取消）
 * 5 - 退款中（买家申请退款）
 * 6 - 已退款（已退款给买家）
 */

const cloud = require('wx-server-sdk');
const TcbRouter = require('tcb-router');

// 引入配置
const KEYS = require('../config/keys.js');

// 云开发环境
cloud.init({
  env: KEYS.WECHAT.cloudEnv || cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 订单状态常量
const ORDER_STATUS = {
  PENDING: 1,      // 待发货（买家已付款）
  SHIPPED: 2,      // 已发货
  COMPLETED: 3,    // 已完成
  CANCELLED: 4,     // 已取消
  REFUNDING: 5,    // 退款中
  REFUNDED: 6,     // 已退款
};

exports.main = async (event, context) => {
  const app = new TcbRouter({ event });
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  // ============================================
  // 1. 创建订单
  // ============================================
  app.router('create', async (ctx) => {
    const { publishId, price, bookinfo, deliveryid, ztplace, psplace, sellerOpenid } = event;

    // 参数校验
    if (!publishId || !price || !bookinfo) {
      ctx.body = { success: false, message: '参数错误' };
      return;
    }

    try {
      // 1. 检查发布信息
      const publishRes = await db.collection('publish').doc(publishId).get();
      if (!publishRes.data) {
        ctx.body = { success: false, message: '书籍不存在' };
        return;
      }

      const publish = publishRes.data;

      // 检查是否已售
      if (publish.status !== 0) {
        ctx.body = { success: false, message: '该书籍已售出' };
        return;
      }

      // 不能买自己的书
      if (publish._openid === openid) {
        ctx.body = { success: false, message: '不能购买自己发布的书籍' };
        return;
      }

      // 2. 检查买家余额（服务端验证，更安全）
      const buyerRes = await db.collection('user').where({ _openid: openid }).get();
      if (!buyerRes.data || buyerRes.data.length === 0) {
        ctx.body = { success: false, message: '用户不存在' };
        return;
      }

      const buyer = buyerRes.data[0];
      const currentBalance = parseFloat(buyer.parse || 0);
      const bookPrice = parseFloat(price);

      if (currentBalance < bookPrice) {
        ctx.body = { success: false, message: '余额不足' };
        return;
      }

      // 3. 扣除买家余额
      const newBalance = currentBalance - bookPrice;
      await db.collection('user').doc(buyer._id).update({
        data: {
          parse: newBalance,
          updatedat: new Date().getTime()
        }
      });

      // 4. 更新发布状态为已售
      await db.collection('publish').doc(publishId).update({
        data: {
          status: 1,
          soldtime: new Date().getTime(),
          buyerOpenid: openid
        }
      });

      // 5. 创建订单记录
      const orderRes = await db.collection('order').add({
        data: {
          creat: new Date().getTime(),
          status: ORDER_STATUS.PENDING, // 待发货
          price: bookPrice,
          deliveryid: deliveryid || 0,
          ztplace: ztplace || '',
          psplace: psplace || '',
          bookinfo: {
            _id: bookinfo._id,
            title: bookinfo.title,
            author: bookinfo.author || '',
            pic: bookinfo.pic || '',
            edition: bookinfo.edition || '',
          },
          seller: sellerOpenid,
          buyer: openid,
          sellid: publishId,
        }
      });

      // 6. 添加买家交易记录
      await db.collection('history').add({
        data: {
          stamp: new Date().getTime(),
          type: 2, // 2=支付
          name: `购买书籍: ${bookinfo.title}`,
          num: bookPrice,
          oid: openid,
          orderid: orderRes.id,
          balance: newBalance,
        }
      });

      // 7. 发送邮件通知卖家（如果启用）
      if (KEYS.EMAIL.enabled && KEYS.EMAIL.receiver.sendToSeller) {
        cloud.callFunction({
          name: 'email',
          data: {
            type: 1, // 1=下单提醒 → 发货提醒
            sellerOpenid: sellerOpenid,
            title: bookinfo.title,
          }
        }).catch(err => console.error('发送邮件失败:', err));
      }

      ctx.body = {
        success: true,
        message: '购买成功',
        data: {
          orderId: orderRes.id,
          newBalance: newBalance,
          price: bookPrice,
        }
      };
    } catch (e) {
      console.error('创建订单失败:', e);
      ctx.body = { success: false, message: '创建订单失败: ' + e.message };
    }
  });

  // ============================================
  // 2. 获取订单列表
  // ============================================
  app.router('getlist', async (ctx) => {
    const { type = 'all', status } = event; // type: all/buy/sell

    try {
      let query = db.collection('order');

      // 按类型筛选
      if (type === 'buy') {
        query = query.where({ buyer: openid });
      } else if (type === 'sell') {
        query = query.where({ seller: openid });
      } else {
        // 全部：自己的买和卖
        query = query.where(
          db.command.or(
            { buyer: openid },
            { seller: openid }
          )
        );
      }

      // 按状态筛选
      if (status !== undefined && status !== null) {
        query = query.where({ ...query._where, status: parseInt(status) });
      }

      const res = await query.orderBy('creat', 'desc').limit(50).get();

      // 处理订单，添加买卖家标记
      const orders = res.data.map(order => ({
        ...order,
        isBuyer: order.buyer === openid,
        isSeller: order.seller === openid,
      }));

      ctx.body = {
        success: true,
        data: orders
      };
    } catch (e) {
      console.error('获取订单列表失败:', e);
      ctx.body = { success: false, message: '获取订单列表失败' };
    }
  });

  // ============================================
  // 3. 获取订单详情
  // ============================================
  app.router('getdetail', async (ctx) => {
    const { orderId } = event;

    if (!orderId) {
      ctx.body = { success: false, message: '订单ID不能为空' };
      return;
    }

    try {
      const orderRes = await db.collection('order').doc(orderId).get();

      if (!orderRes.data) {
        ctx.body = { success: false, message: '订单不存在' };
        return;
      }

      const order = orderRes.data;

      // 检查权限
      if (order.buyer !== openid && order.seller !== openid) {
        ctx.body = { success: false, message: '无权查看此订单' };
        return;
      }

      // 获取买家信息
      let buyerInfo = null;
      if (order.buyer) {
        const buyerRes = await db.collection('user').where({ _openid: order.buyer }).get();
        if (buyerRes.data && buyerRes.data.length > 0) {
          buyerInfo = {
            nickname: buyerRes.data[0].nickname,
            avatar: buyerRes.data[0].avatar,
          };
        }
      }

      // 获取卖家信息
      let sellerInfo = null;
      if (order.seller) {
        const sellerRes = await db.collection('user').where({ _openid: order.seller }).get();
        if (sellerRes.data && sellerRes.data.length > 0) {
          sellerInfo = {
            nickname: sellerRes.data[0].nickname,
            avatar: sellerRes.data[0].avatar,
          };
        }
      }

      ctx.body = {
        success: true,
        data: {
          ...order,
          isBuyer: order.buyer === openid,
          isSeller: order.seller === openid,
          buyerInfo,
          sellerInfo,
        }
      };
    } catch (e) {
      console.error('获取订单详情失败:', e);
      ctx.body = { success: false, message: '获取订单详情失败' };
    }
  });

  // ============================================
  // 4. 卖家发货
  // ============================================
  app.router('ship', async (ctx) => {
    const { orderId } = event;

    if (!orderId) {
      ctx.body = { success: false, message: '订单ID不能为空' };
      return;
    }

    try {
      // 获取订单
      const orderRes = await db.collection('order').doc(orderId).get();
      if (!orderRes.data) {
        ctx.body = { success: false, message: '订单不存在' };
        return;
      }

      const order = orderRes.data;

      // 检查权限
      if (order.seller !== openid) {
        ctx.body = { success: false, message: '无权操作此订单' };
        return;
      }

      // 检查状态
      if (order.status !== ORDER_STATUS.PENDING) {
        ctx.body = { success: false, message: '订单状态不正确，无法发货' };
        return;
      }

      // 更新订单状态
      await db.collection('order').doc(orderId).update({
        data: {
          status: ORDER_STATUS.SHIPPED,
          shiptime: new Date().getTime(),
        }
      });

      ctx.body = {
        success: true,
        message: '发货成功'
      };
    } catch (e) {
      console.error('发货失败:', e);
      ctx.body = { success: false, message: '发货失败: ' + e.message };
    }
  });

  // ============================================
  // 5. 确认收货
  // ============================================
    } catch (e) {
      console.error('发货失败:', e);
      ctx.body = { success: false, message: '发货失败: ' + e.message };
    }
  });

  // ============================================
  // 5. 确认收货
  // ============================================
  app.router('receive', async (ctx) => {
    const { orderId } = event;

    if (!orderId) {
      ctx.body = { success: false, message: '订单ID不能为空' };
      return;
    }

    try {
      // 获取订单
      const orderRes = await db.collection('order').doc(orderId).get();
      if (!orderRes.data) {
        ctx.body = { success: false, message: '订单不存在' };
        return;
      }

      const order = orderRes.data;

      // 检查权限
      if (order.buyer !== openid) {
        ctx.body = { success: false, message: '无权操作此订单' };
        return;
      }

      // 检查状态
      if (order.status !== ORDER_STATUS.SHIPPED) {
        ctx.body = { success: false, message: '订单状态不正确' };
        return;
      }

      // 1. 更新订单状态
      await db.collection('order').doc(orderId).update({
        data: {
          status: ORDER_STATUS.COMPLETED,
          completetime: new Date().getTime(),
        }
      });

      // 2. 卖家收款
      const sellerRes = await db.collection('user').where({ _openid: order.seller }).get();
      if (sellerRes.data && sellerRes.data.length > 0) {
        const seller = sellerRes.data[0];
        const newBalance = (seller.parse || 0) + order.price;

        await db.collection('user').doc(seller._id).update({
          data: {
            parse: newBalance,
            updatedat: new Date().getTime()
          }
        });

        // 添加卖家交易记录
        await db.collection('history').add({
          data: {
            stamp: new Date().getTime(),
            type: 3, // 3=收款
            name: `出售书籍: ${order.bookinfo?.title || '书籍'}`,
            num: order.price,
            oid: order.seller,
            orderid: orderId,
            balance: newBalance,
          }
        });
      }

      // 3. 邮件通知卖家：交易完成
      if (KEYS.EMAIL.enabled) {
        cloud.callFunction({
          name: 'email',
          data: {
            type: 5, // 交易完成通知
            sellerOpenid: order.seller,
            title: order.bookinfo?.title || '书籍',
          }
        }).catch(err => console.error('发送交易完成邮件失败:', err));
      }

      ctx.body = {
        success: true,
        message: '确认收货成功，交易完成'
      };
    } catch (e) {
      console.error('确认收货失败:', e);
      ctx.body = { success: false, message: '确认收货失败: ' + e.message };
    }
  });

  // ============================================
  // 6. 申请退款
  // ============================================
  app.router('refund', async (ctx) => {
    const { orderId, reason } = event;

    if (!orderId) {
      ctx.body = { success: false, message: '订单ID不能为空' };
      return;
    }

    try {
      const orderRes = await db.collection('order').doc(orderId).get();
      if (!orderRes.data) {
        ctx.body = { success: false, message: '订单不存在' };
        return;
      }

      const order = orderRes.data;

      // 检查权限
      if (order.buyer !== openid) {
        ctx.body = { success: false, message: '无权操作此订单' };
        return;
      }

      // 检查状态（只能对待发货的订单申请退款）
      if (order.status !== ORDER_STATUS.PENDING) {
        ctx.body = { success: false, message: '当前状态无法申请退款' };
        return;
      }

      // 更新订单状态
      await db.collection('order').doc(orderId).update({
        data: {
          status: ORDER_STATUS.REFUNDING,
          refundtime: new Date().getTime(),
          refundreason: reason || '',
        }
      });

      ctx.body = {
        success: true,
        message: '已申请退款，请等待卖家处理'
      };
    } catch (e) {
      console.error('申请退款失败:', e);
      ctx.body = { success: false, message: '申请退款失败: ' + e.message };
    }
  });

  // ============================================
  // 7. 同意退款（卖家）
  // ============================================
  app.router('agreeRefund', async (ctx) => {
    const { orderId } = event;

    if (!orderId) {
      ctx.body = { success: false, message: '订单ID不能为空' };
      return;
    }

    try {
      const orderRes = await db.collection('order').doc(orderId).get();
      if (!orderRes.data) {
        ctx.body = { success: false, message: '订单不存在' };
        return;
      }

      const order = orderRes.data;

      // 检查权限
      if (order.seller !== openid) {
        ctx.body = { success: false, message: '无权操作此订单' };
        return;
      }

      // 检查状态
      if (order.status !== ORDER_STATUS.REFUNDING) {
        ctx.body = { success: false, message: '订单状态不正确' };
        return;
      }

      // 1. 更新订单状态为已退款
      await db.collection('order').doc(orderId).update({
        data: {
          status: ORDER_STATUS.REFUNDED,
          refunddonetime: new Date().getTime(),
        }
      });

      // 2. 恢复发布状态
      await db.collection('publish').doc(order.sellid).update({
        data: {
          status: 0, // 恢复在售
          soldtime: null,
          buyerOpenid: null,
        }
      });

      // 3. 退款给买家
      const buyerRes = await db.collection('user').where({ _openid: order.buyer }).get();
      if (buyerRes.data && buyerRes.data.length > 0) {
        const buyer = buyerRes.data[0];
        const newBalance = (buyer.parse || 0) + order.price;

        await db.collection('user').doc(buyer._id).update({
          data: {
            parse: newBalance,
            updatedat: new Date().getTime()
          }
        });

        // 添加买家交易记录
        await db.collection('history').add({
          data: {
            stamp: new Date().getTime(),
            type: 4, // 4=退款
            name: `退款: ${order.bookinfo?.title || '书籍'}`,
            num: order.price,
            oid: order.buyer,
            orderid: orderId,
            balance: newBalance,
          }
        });
      }

      // 4. 邮件通知买家：订单取消退款
      if (KEYS.EMAIL.enabled) {
        cloud.callFunction({
          name: 'email',
          data: {
            type: 3, // 交易取消提醒
            sellerOpenid: order.buyer, // 这里是买家openid，发给买家
            title: order.bookinfo?.title || '书籍',
          }
        }).catch(err => console.error('发送取消邮件失败:', err));
      }

      ctx.body = {
        success: true,
        message: '已同意退款，款项将退还给买家'
      };
    } catch (e) {
      console.error('同意退款失败:', e);
      ctx.body = { success: false, message: '操作失败: ' + e.message };
    }
  });

  // ============================================
  // 8. 拒绝退款（卖家）
  // ============================================
  app.router('rejectRefund', async (ctx) => {
    const { orderId } = event;

    if (!orderId) {
      ctx.body = { success: false, message: '订单ID不能为空' };
      return;
    }

    try {
      const orderRes = await db.collection('order').doc(orderId).get();
      if (!orderRes.data) {
        ctx.body = { success: false, message: '订单不存在' };
        return;
      }

      const order = orderRes.data;

      // 检查权限
      if (order.seller !== openid) {
        ctx.body = { success: false, message: '无权操作此订单' };
        return;
      }

      // 检查状态
      if (order.status !== ORDER_STATUS.REFUNDING) {
        ctx.body = { success: false, message: '订单状态不正确' };
        return;
      }

      // 恢复订单状态为待发货
      await db.collection('order').doc(orderId).update({
        data: {
          status: ORDER_STATUS.PENDING,
          refundtime: null,
          refundreason: null,
        }
      });

      ctx.body = {
        success: true,
        message: '已拒绝退款，订单将继续进行'
      };
    } catch (e) {
      console.error('拒绝退款失败:', e);
      ctx.body = { success: false, message: '操作失败: ' + e.message };
    }
  });

  // ============================================
  // 9. 取消订单（未付款）
  // ============================================
  app.router('cancel', async (ctx) => {
    const { orderId } = event;

    if (!orderId) {
      ctx.body = { success: false, message: '订单ID不能为空' };
      return;
    }

    try {
      const orderRes = await db.collection('order').doc(orderId).get();
      if (!orderRes.data) {
        ctx.body = { success: false, message: '订单不存在' };
        return;
      }

      const order = orderRes.data;

      // 检查权限
      if (order.buyer !== openid && order.seller !== openid) {
        ctx.body = { success: false, message: '无权操作此订单' };
        return;
      }

      // 检查状态（只能取消待发货的）
      if (order.status !== ORDER_STATUS.PENDING) {
        ctx.body = { success: false, message: '当前状态无法取消' };
        return;
      }

      // 1. 更新订单状态
      await db.collection('order').doc(orderId).update({
        data: {
          status: ORDER_STATUS.CANCELLED,
          canceltime: new Date().getTime(),
        }
      });

      // 2. 恢复发布状态
      await db.collection('publish').doc(order.sellid).update({
        data: {
          status: 0,
          soldtime: null,
          buyerOpenid: null,
        }
      });

      // 3. 退款给买家
      const buyerRes = await db.collection('user').where({ _openid: order.buyer }).get();
      if (buyerRes.data && buyerRes.data.length > 0) {
        const buyer = buyerRes.data[0];
        const newBalance = (buyer.parse || 0) + order.price;

        await db.collection('user').doc(buyer._id).update({
          data: {
            parse: newBalance,
            updatedat: new Date().getTime()
          }
        });

        await db.collection('history').add({
          data: {
            stamp: new Date().getTime(),
            type: 4,
            name: `取消订单退款: ${order.bookinfo?.title || '书籍'}`,
            num: order.price,
            oid: order.buyer,
            orderid: orderId,
            balance: newBalance,
          }
        });
      }

      // 4. 邮件通知
      if (KEYS.EMAIL.enabled) {
        const isCancelledByBuyer = order.buyer === openid;
        const emailType = isCancelledByBuyer ? 4 : 3; // 买家取消→通知卖家(4)，卖家取消→通知买家(3)
        const notifyOpenid = isCancelledByBuyer ? order.seller : order.buyer;
        cloud.callFunction({
          name: 'email',
          data: {
            type: emailType,
            sellerOpenid: notifyOpenid,
            title: order.bookinfo?.title || '书籍',
          }
        }).catch(err => console.error('发送取消邮件失败:', err));
      }

      ctx.body = {
        success: true,
        message: '订单已取消'
      };
    } catch (e) {
      console.error('取消订单失败:', e);
      ctx.body = { success: false, message: '操作失败: ' + e.message };
    }
  });

  return app.serve();
};
