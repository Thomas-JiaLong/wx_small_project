/**
 * 订单列表页
 */
const app = getApp();
const config = require("../../../config.js");
const LoginCheck = require("../../../utils/login-check.js");
let db, _;

Page({
  data: {
    scrollTop: 0,
    nomore: false,
    page: 0,
    list: [],
    tab: [
      { name: '全部', id: 0 },
      { name: '待发货', id: 1 },
      { name: '待收货', id: 2 },
      { name: '已完成', id: 3 },
      { name: '已取消', id: 4 },
    ],
    tabid: 0,
  },

  onLoad() {
    // 检查登录状态
    if (!LoginCheck.isLoggedIn()) {
      LoginCheck.check(() => {
        this.loadData();
      }, {
        toastMessage: '查看订单需要登录后使用'
      });
      return;
    }
    this.loadData();
  },

  onShow() {
    if (db) {
      this.getlist();
    }
  },

  loadData() {
    app.ensureCloudReady().then(() => {
      db = wx.cloud.database();
      _ = db.command;
      this.getlist();
    });
  },

  // 导航栏切换
  changeTab(e) {
    this.setData({
      tabid: e.currentTarget.dataset.id,
      page: 0,
      nomore: false,
      list: []
    });
    this.getlist();
  },

  // 跳转详情页
  godetail(e) {
    wx.navigateTo({
      url: '/pages/order/detail/detail?id=' + e.currentTarget.dataset.id,
    });
  },

  // 获取订单列表
  getlist() {
    let that = this;
    let status = that.data.tabid;

    wx.showLoading({ title: '加载中...' });

    // 使用云函数获取订单列表（支持买卖双方）
    wx.cloud.callFunction({
      name: 'order',
      data: {
        $url: 'getlist',
        type: 'all',
        status: status > 0 ? status : undefined,
      },
      success: res => {
        wx.stopPullDownRefresh();
        wx.hideLoading();

        if (res.result && res.result.success) {
          let orders = res.result.data;
          
          // 处理订单数据
          orders = orders.map(order => {
            return {
              ...order,
              roleText: order.isBuyer ? '买入' : '卖出',
              statusText: that.getStatusText(order.status, order.isBuyer),
            };
          });

          that.setData({
            nomore: true,
            list: orders,
          });
        } else {
          that.setData({ list: [] });
        }
      },
      fail: err => {
        wx.stopPullDownRefresh();
        wx.hideLoading();
        wx.showToast({ title: '获取订单失败', icon: 'none' });
      }
    });
  },

  // 获取状态文本
  getStatusText(status, isBuyer) {
    const map = {
      1: isBuyer ? '待发货' : '待发货',
      2: isBuyer ? '待收货' : '已发货',
      3: '已完成',
      4: '已取消',
      5: isBuyer ? '退款中' : '待处理',
      6: '已退款',
    };
    return map[status] || '未知';
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.setData({ page: 0, nomore: false });
    this.getlist();
  },

  // 加载更多
  onReachBottom() {
    // 暂不支持分页加载
  },

  // 取消订单
  cancel(e) {
    let that = this;
    let detail = e.currentTarget.dataset.ord;

    wx.showModal({
      title: '温馨提示',
      content: '确定要取消该订单吗？取消后金额将退回钱包。',
      success(res) {
        if (res.confirm) {
          that.doCancel(detail);
        }
      }
    });
  },

  doCancel(detail) {
    wx.showLoading({ title: '处理中...' });

    wx.cloud.callFunction({
      name: 'order',
      data: {
        $url: 'cancel',
        orderId: detail._id,
      },
      success: res => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          wx.showToast({ title: '订单已取消', icon: 'success' });
          this.getlist();
        } else {
          wx.showToast({ title: res.result?.message || '操作失败', icon: 'none' });
        }
      },
      fail: err => {
        wx.hideLoading();
        wx.showToast({ title: '操作失败', icon: 'none' });
      }
    });
  },

  // 确认收货
  confirm(e) {
    let that = this;
    let detail = e.currentTarget.dataset.ord;

    wx.showModal({
      title: '确认收货',
      content: '确认已收到书籍了吗？确认后款项将打给卖家。',
      success(res) {
        if (res.confirm) {
          that.doConfirm(detail);
        }
      }
    });
  },

  doConfirm(detail) {
    wx.showLoading({ title: '处理中...' });

    wx.cloud.callFunction({
      name: 'order',
      data: {
        $url: 'receive',
        orderId: detail._id,
      },
      success: res => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          wx.showToast({ title: '交易完成', icon: 'success' });
          this.getlist();
        } else {
          wx.showToast({ title: res.result?.message || '操作失败', icon: 'none' });
        }
      },
      fail: err => {
        wx.hideLoading();
        wx.showToast({ title: '操作失败', icon: 'none' });
      }
    });
  },

  // 申请退款
  refund(e) {
    let that = this;
    let detail = e.currentTarget.dataset.ord;

    wx.showModal({
      title: '申请退款',
      content: '确定要申请退款吗？',
      success(res) {
        if (res.confirm) {
          that.doRefund(detail);
        }
      }
    });
  },

  doRefund(detail) {
    wx.showLoading({ title: '处理中...' });

    wx.cloud.callFunction({
      name: 'order',
      data: {
        $url: 'refund',
        orderId: detail._id,
      },
      success: res => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          wx.showToast({ title: '已申请退款', icon: 'success' });
          this.getlist();
        } else {
          wx.showToast({ title: res.result?.message || '操作失败', icon: 'none' });
        }
      },
      fail: err => {
        wx.hideLoading();
        wx.showToast({ title: '操作失败', icon: 'none' });
      }
    });
  },

  // 删除订单
  deleteOrder(e) {
    let that = this;
    let detail = e.currentTarget.dataset.ord;

    wx.showModal({
      title: '删除订单',
      content: '确定要删除此订单吗？',
      success(res) {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          db.collection('order').doc(detail._id).remove({
            success: () => {
              wx.hideLoading();
              wx.showToast({ title: '已删除', icon: 'success' });
              that.getlist();
            },
            fail: () => {
              wx.hideLoading();
              wx.showToast({ title: '删除失败', icon: 'none' });
            }
          });
        }
      }
    });
  },

  // 至顶
  gotop() {
    wx.pageScrollTo({ scrollTop: 0 });
  },

  // 监测屏幕滚动
  onPageScroll: function(e) {
    this.setData({
      scrollTop: parseInt((e.scrollTop) * wx.getSystemInfoSync().pixelRatio)
    });
  },
});
