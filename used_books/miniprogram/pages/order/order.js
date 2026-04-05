/**
 * 我的订单页面
 */
const app = getApp();
const config = require("../../config.js");
let db, _;

Page({
  data: {
    active: 0, // 0=全部 1=待发货 2=待收货 3=已完成
    orders: [],
    orderStatus: [
      { text: '全部', value: 0 },
      { text: '待发货', value: 1 },
      { text: '待收货', value: 2 },
      { text: '已完成', value: 3 },
    ],
    loading: false,
  },

  onLoad(options) {
    app.ensureCloudReady().then(() => {
      db = wx.cloud.database();
      _ = db.command;
      this.getOrders();
    });
  },

  onShow() {
    if (db) {
      this.getOrders();
    }
  },

  // 切换tab
  onTabChange(e) {
    this.setData({ active: e.detail.name });
    this.getOrders();
  },

  // 获取订单列表
  getOrders() {
    if (!app.openid) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    this.setData({ loading: true });

    // 构建查询
    let query = db.collection('order');
    
    // 筛选买家或卖家的订单
    query = query.where(
      _.or([
        { buyer: app.openid },  // 我买的
        { seller: app.openid }  // 我卖的
      ])
    );

    // 按状态筛选
    const statusMap = { 1: 1, 2: 2, 3: 3 };
    if (this.data.active > 0 && statusMap[this.data.active]) {
      query = query.where({ status: statusMap[this.data.active] });
    }

    query.orderBy('creat', 'desc')
      .get()
      .then(res => {
        this.setData({ loading: false });
        if (res.data.length > 0) {
          // 处理订单数据，区分买卖家视角
          const orders = res.data.map(order => {
            const isBuyer = order.buyer === app.openid;
            return {
              ...order,
              isBuyer: isBuyer,
              showStatus: this.getShowStatus(order.status, isBuyer),
              roleText: isBuyer ? '买入' : '卖出',
            };
          });
          this.setData({ orders });
        } else {
          this.setData({ orders: [] });
        }
      })
      .catch(err => {
        this.setData({ loading: false });
        wx.showToast({ title: '获取订单失败', icon: 'none' });
      });
  },

  // 获取显示状态
  getShowStatus(status, isBuyer) {
    const statusMap = {
      1: isBuyer ? '待发货' : '待发货',
      2: isBuyer ? '待收货' : '已发货',
      3: '已完成',
      4: '已取消',
      5: '退款中',
      6: '已退款',
    };
    return statusMap[status] || '未知';
  },

  // 查看订单详情
  viewOrder(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/order-detail/order-detail?id=${id}`,
    });
  },

  // 确认收货 (买家)
  confirmReceive(e) {
    const order = e.currentTarget.dataset.order;
    
    wx.showModal({
      title: '确认收货',
      content: '确认收到书籍了吗？确认后款项将打给卖家。',
      success: res => {
        if (res.confirm) {
          this.doConfirmReceive(order);
        }
      }
    });
  },

  // 执行确认收货
  doConfirmReceive(order) {
    wx.showLoading({ title: '处理中...' });

    // 1. 更新订单状态为已完成
    db.collection('order').doc(order._id).update({
      data: {
        status: 3, // 已完成
        completetime: new Date().getTime(),
      }
    }).then(() => {
      // 2. 卖家收款
      return wx.cloud.callFunction({
        name: 'his',
        data: {
          $url: 'toseller',
          seller: order.seller,
          num: order.price,
          orderid: order._id,
          booktitle: order.bookinfo?.title || '书籍',
        }
      });
    }).then(() => {
      wx.hideLoading();
      wx.showToast({ title: '交易完成', icon: 'success' });
      this.getOrders();
    }).catch(err => {
      wx.hideLoading();
      wx.showToast({ title: '操作失败', icon: 'none' });
    });
  },

  // 申请退款 (买家)
  applyRefund(e) {
    const order = e.currentTarget.dataset.order;
    
    wx.showModal({
      title: '申请退款',
      content: '确定要申请退款吗？',
      success: res => {
        if (res.confirm) {
          this.doApplyRefund(order);
        }
      }
    });
  },

  // 执行申请退款
  doApplyRefund(order) {
    wx.showLoading({ title: '处理中...' });

    // 更新订单状态为退款中
    db.collection('order').doc(order._id).update({
      data: {
        status: 5, // 退款中
        refundtime: new Date().getTime(),
      }
    }).then(() => {
      wx.hideLoading();
      wx.showToast({ title: '已申请退款，请等待卖家确认', icon: 'success' });
      this.getOrders();
    }).catch(err => {
      wx.hideLoading();
      wx.showToast({ title: '操作失败', icon: 'none' });
    });
  },

  // 确认退款 (卖家)
  confirmRefund(e) {
    const order = e.currentTarget.dataset.order;
    
    wx.showModal({
      title: '确认退款',
      content: '确定退款给买家吗？退款后订单将取消。',
      success: res => {
        if (res.confirm) {
          this.doConfirmRefund(order);
        }
      }
    });
  },

  // 执行退款
  doConfirmRefund(order) {
    wx.showLoading({ title: '处理中...' });

    // 1. 更新订单状态为已退款
    db.collection('order').doc(order._id).update({
      data: {
        status: 6, // 已退款
        refunddonetime: new Date().getTime(),
      }
    }).then(() => {
      // 2. 恢复发布状态
      return wx.cloud.callFunction({
        name: 'pay',
        data: {
          $url: 'changeP',
          _id: order.sellid,
          status: 0, // 恢复在售
        }
      });
    }).then(() => {
      // 3. 退款给买家
      return wx.cloud.callFunction({
        name: 'his',
        data: {
          $url: 'tobuyer',
          buyer: order.buyer,
          num: order.price,
          orderid: order._id,
          booktitle: order.bookinfo?.title || '书籍',
        }
      });
    }).then(() => {
      wx.hideLoading();
      wx.showToast({ title: '退款成功', icon: 'success' });
      this.getOrders();
    }).catch(err => {
      wx.hideLoading();
      wx.showToast({ title: '操作失败', icon: 'none' });
    });
  },

  // 拒绝退款 (卖家)
  rejectRefund(e) {
    const order = e.currentTarget.dataset.order;
    
    wx.showModal({
      title: '拒绝退款',
      content: '确定拒绝退款吗？订单将继续进行。',
      success: res => {
        if (res.confirm) {
          this.doRejectRefund(order);
        }
      }
    });
  },

  // 执行拒绝退款
  doRejectRefund(order) {
    wx.showLoading({ title: '处理中...' });

    db.collection('order').doc(order._id).update({
      data: {
        status: 1, // 恢复待发货
      }
    }).then(() => {
      wx.hideLoading();
      wx.showToast({ title: '已拒绝退款', icon: 'success' });
      this.getOrders();
    }).catch(err => {
      wx.hideLoading();
      wx.showToast({ title: '操作失败', icon: 'none' });
    });
  },

  // 提醒发货 (买家)
  remindShip(e) {
    wx.showToast({ title: '已提醒卖家发货', icon: 'success' });
    // TODO: 发送通知给卖家
  },

  // 联系对方
  contactUser(e) {
    const openid = e.currentTarget.dataset.openid;
    wx.navigateTo({
      url: `/pages/chat/chat?openid=${openid}`,
    });
  },
});
