/**
 * ============================================
 *  his - 历史记录 & 钱包核心操作云函数
 * ============================================
 * 
 * 功能列表：
 * 1. recharge     - 钱包充值
 * 2. toseller     - 卖家收款（确认收货）
 * 3. tobuyer      - 退款给买家（取消订单）
 * 4. gethistory   - 获取交易记录
 * 5. getbalance   - 获取余额
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

// 状态码定义
const STATUS = {
  ORDER: {
    PENDING: 1,    // 待发货
    SHIPPED: 2,    // 已发货
    COMPLETED: 3,  // 已完成
    CANCELLED: 4,  // 已取消（手动）
    REFUNDING: 5,  // 退款中
    REFUNDED: 6,  // 已退款
  }
};

exports.main = async (event, context) => {
  const app = new TcbRouter({ event });
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  // ============================================
  // 1. 钱包充值
  // ============================================
  app.router('recharge', async (ctx) => {
    const amount = parseFloat(event.num) || 0;
    
    if (amount <= 0) {
      ctx.body = { success: false, message: '充值金额必须大于0' };
      return;
    }

    try {
      // 获取用户信息
      const userRes = await db.collection('user').where({
        _openid: openid
      }).get();

      if (!userRes.data || userRes.data.length === 0) {
        ctx.body = { success: false, message: '用户不存在' };
        return;
      }

      const user = userRes.data[0];
      const currentBalance = parseFloat(user.parse || 0);
      const newBalance = currentBalance + amount;

      // 更新用户余额
      await db.collection('user').doc(user._id).update({
        data: {
          parse: newBalance,
          updatedat: new Date().getTime()
        }
      });

      // 添加交易记录
      await db.collection('history').add({
        data: {
          stamp: new Date().getTime(),
          type: 1, // 1=充值
          name: '钱包充值',
          num: amount,
          oid: openid,
          balance: newBalance, // 充值后余额
        }
      });

      ctx.body = {
        success: true,
        message: '充值成功',
        data: {
          balance: newBalance,
          amount: amount,
        }
      };
    } catch (e) {
      console.error('充值失败:', e);
      ctx.body = { success: false, message: '充值失败: ' + e.message };
    }
  });

  // ============================================
  // 2. 卖家收款（确认收货后）
  // ============================================
  app.router('toseller', async (ctx) => {
    const sellerOpenid = event.seller;
    const amount = parseFloat(event.num) || 0;
    const orderId = event.orderid || '';
    const bookTitle = event.booktitle || '书籍';

    if (!sellerOpenid) {
      ctx.body = { success: false, message: '卖家信息错误' };
      return;
    }

    if (amount <= 0) {
      ctx.body = { success: false, message: '金额错误' };
      return;
    }

    try {
      // 获取卖家信息
      const sellerRes = await db.collection('user').where({
        _openid: sellerOpenid
      }).get();

      if (!sellerRes.data || sellerRes.data.length === 0) {
        ctx.body = { success: false, message: '卖家不存在' };
        return;
      }

      const seller = sellerRes.data[0];
      const currentBalance = parseFloat(seller.parse || 0);
      const newBalance = currentBalance + amount;

      // 更新卖家余额
      await db.collection('user').doc(seller._id).update({
        data: {
          parse: newBalance,
          updatedat: new Date().getTime()
        }
      });

      // 添加交易记录
      await db.collection('history').add({
        data: {
          stamp: new Date().getTime(),
          type: 3, // 3=收款
          name: `出售书籍: ${bookTitle}`,
          num: amount,
          oid: sellerOpenid,
          orderid: orderId,
          balance: newBalance,
        }
      });

      ctx.body = {
        success: true,
        message: '收款成功',
        data: {
          balance: newBalance,
          amount: amount,
        }
      };
    } catch (e) {
      console.error('收款失败:', e);
      ctx.body = { success: false, message: '收款失败: ' + e.message };
    }
  });

  // ============================================
  // 3. 退款给买家（取消订单）
  // ============================================
  app.router('tobuyer', async (ctx) => {
    const buyerOpenid = event.buyer;
    const amount = parseFloat(event.num) || 0;
    const orderId = event.orderid || '';
    const bookTitle = event.booktitle || '书籍';

    if (!buyerOpenid) {
      ctx.body = { success: false, message: '买家信息错误' };
      return;
    }

    if (amount <= 0) {
      ctx.body = { success: false, message: '金额错误' };
      return;
    }

    try {
      // 获取买家信息
      const buyerRes = await db.collection('user').where({
        _openid: buyerOpenid
      }).get();

      if (!buyerRes.data || buyerRes.data.length === 0) {
        ctx.body = { success: false, message: '买家不存在' };
        return;
      }

      const buyer = buyerRes.data[0];
      const currentBalance = parseFloat(buyer.parse || 0);
      const newBalance = currentBalance + amount;

      // 退款给买家
      await db.collection('user').doc(buyer._id).update({
        data: {
          parse: newBalance,
          updatedat: new Date().getTime()
        }
      });

      // 添加交易记录
      await db.collection('history').add({
        data: {
          stamp: new Date().getTime(),
          type: 4, // 4=退款
          name: `订单取消退款: ${bookTitle}`,
          num: amount,
          oid: buyerOpenid,
          orderid: orderId,
          balance: newBalance,
        }
      });

      ctx.body = {
        success: true,
        message: '退款成功',
        data: {
          balance: newBalance,
          amount: amount,
        }
      };
    } catch (e) {
      console.error('退款失败:', e);
      ctx.body = { success: false, message: '退款失败: ' + e.message };
    }
  });

  // ============================================
  // 4. 获取交易记录
  // ============================================
  app.router('gethistory', async (ctx) => {
    try {
      const historyRes = await db.collection('history')
        .where({ oid: openid })
        .orderBy('stamp', 'desc')
        .limit(50) // 限制返回数量
        .get();

      ctx.body = {
        success: true,
        data: historyRes.data || []
      };
    } catch (e) {
      console.error('获取历史记录失败:', e);
      ctx.body = { success: false, message: '获取历史记录失败' };
    }
  });

  // ============================================
  // 5. 获取余额
  // ============================================
  app.router('getbalance', async (ctx) => {
    try {
      const userRes = await db.collection('user').where({
        _openid: openid
      }).get();

      if (!userRes.data || userRes.data.length === 0) {
        ctx.body = { success: false, message: '用户不存在' };
        return;
      }

      ctx.body = {
        success: true,
        data: {
          balance: parseFloat(userRes.data[0].parse || 0)
        }
      };
    } catch (e) {
      console.error('获取余额失败:', e);
      ctx.body = { success: false, message: '获取余额失败' };
    }
  });

  return app.serve();
};
