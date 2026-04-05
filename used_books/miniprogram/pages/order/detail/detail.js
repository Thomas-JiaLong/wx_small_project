/**
 * 订单详情页
 */
const app = getApp();
const config = require("../../../config.js");
const LoginCheck = require("../../../utils/login-check.js");
let db, _;

Page({
  data: {
    detail: null,
    creatTime: '',
    isBuyer: false,
    isSeller: false,
    statusText: '',
  },

  onLoad: function(e) {
    // 检查登录
    if (!LoginCheck.isLoggedIn()) {
      LoginCheck.check(() => {
        this.loadData(e.id);
      }, { toastMessage: '请先登录' });
      return;
    }
    this.loadData(e.id);
  },

  loadData(id) {
    app.ensureCloudReady().then(() => {
      db = wx.cloud.database();
      _ = db.command;
      this.getdetail(id);
    });
  },

  // 获取订单详情
  getdetail(id) {
    let that = this;
    wx.showLoading({ title: '加载中...' });

    wx.cloud.callFunction({
      name: 'order',
      data: {
        $url: 'getdetail',
        orderId: id,
      },
      success: res => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          const detail = res.result.data;
          that.setData({
            detail: detail,
            creatTime: config.formTime(detail.creat),
            isBuyer: detail.isBuyer,
            isSeller: detail.isSeller,
            statusText: that.getStatusText(detail.status, detail.isBuyer),
          });
        } else {
          wx.showToast({ title: res.result?.message || '获取失败', icon: 'none' });
        }
      },
      fail: err => {
        wx.hideLoading();
        wx.showToast({ title: '获取失败', icon: 'none' });
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
      5: isBuyer ? '退款中' : '待处理退款',
      6: '已退款',
    };
    return map[status] || '未知';
  },

  // 回到首页
  home() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  // 复制文本
  copy(e) {
    wx.setClipboardData({
      data: e.currentTarget.dataset.copy,
      success: () => {
        wx.showToast({ title: '复制成功', icon: 'success' });
      }
    });
  },

  // ==========================================
  // 买家操作
  // ==========================================

  // 申请退款
  applyRefund() {
    wx.showModal({
      title: '申请退款',
      content: '确定要申请退款吗？',
      success: res => {
        if (res.confirm) {
          this.doRefund();
        }
      }
    });
  },

  doRefund() {
    wx.showLoading({ title: '处理中...' });
    wx.cloud.callFunction({
      name: 'order',
      data: {
        $url: 'refund',
        orderId: this.data.detail._id,
      },
      success: res => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          wx.showToast({ title: '已申请退款', icon: 'success' });
          this.getdetail(this.data.detail._id);
        } else {
          wx.showToast({ title: res.result?.message || '操作失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '操作失败', icon: 'none' });
      }
    });
  },

  // 确认收货
  confirmReceive() {
    wx.showModal({
      title: '确认收货',
      content: '确认已收到书籍了吗？确认后款项将打给卖家。',
      success: res => {
        if (res.confirm) {
          this.doConfirmReceive();
        }
      }
    });
  },

  doConfirmReceive() {
    wx.showLoading({ title: '处理中...' });
    wx.cloud.callFunction({
      name: 'order',
      data: {
        $url: 'receive',
        orderId: this.data.detail._id,
      },
      success: res => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          wx.showToast({ title: '交易完成', icon: 'success' });
          this.getdetail(this.data.detail._id);
        } else {
          wx.showToast({ title: res.result?.message || '操作失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '操作失败', icon: 'none' });
      }
    });
  },

  // ==========================================
  // 卖家操作
  // ==========================================

  // 确认退款
  agreeRefund() {
    wx.showModal({
      title: '确认退款',
      content: '确定退款给买家吗？退款后订单将取消。',
      success: res => {
        if (res.confirm) {
          this.doAgreeRefund();
        }
      }
    });
  },

  doAgreeRefund() {
    wx.showLoading({ title: '处理中...' });
    wx.cloud.callFunction({
      name: 'order',
      data: {
        $url: 'agreeRefund',
        orderId: this.data.detail._id,
      },
      success: res => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          wx.showToast({ title: '退款成功', icon: 'success' });
          this.getdetail(this.data.detail._id);
        } else {
          wx.showToast({ title: res.result?.message || '操作失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '操作失败', icon: 'none' });
      }
    });
  },

  // 拒绝退款
  rejectRefund() {
    wx.showModal({
      title: '拒绝退款',
      content: '确定拒绝退款吗？订单将继续进行。',
      success: res => {
        if (res.confirm) {
          this.doRejectRefund();
        }
      }
    });
  },

  doRejectRefund() {
    wx.showLoading({ title: '处理中...' });
    wx.cloud.callFunction({
      name: 'order',
      data: {
        $url: 'rejectRefund',
        orderId: this.data.detail._id,
      },
      success: res => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          wx.showToast({ title: '已拒绝退款', icon: 'success' });
          this.getdetail(this.data.detail._id);
        } else {
          wx.showToast({ title: res.result?.message || '操作失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '操作失败', icon: 'none' });
      }
    });
  },

  // 发货（标记为已发货）
  ship() {
    wx.showModal({
      title: '确认发货',
      content: '确认已经发货给买家了吗？',
      success: res => {
        if (res.confirm) {
          this.doShip();
        }
      }
    });
  },

  doShip() {
    wx.showLoading({ title: '处理中...' });
    wx.cloud.callFunction({
      name: 'order',
      data: {
        $url: 'ship',
        orderId: this.data.detail._id,
      },
      success: res => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          wx.showToast({ title: '发货成功', icon: 'success' });
          this.getdetail(this.data.detail._id);
        } else {
          wx.showToast({ title: res.result?.message || '操作失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '操作失败', icon: 'none' });
      }
    });
  },

  // ==========================================
  // 通用操作
  // ==========================================

  // 删除订单
  deleteOrder() {
    wx.showModal({
      title: '删除订单',
      content: '确定要删除此订单吗？',
      success: res => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          db.collection('order').doc(this.data.detail._id).remove({
            success: () => {
              wx.hideLoading();
              wx.showToast({ title: '已删除', icon: 'success' });
              setTimeout(() => {
                let pages = getCurrentPages();
                wx.navigateBack();
              }, 1000);
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

  // 联系对方
  contactUser() {
    const openid = this.data.isBuyer ? this.data.detail.seller : this.data.detail.buyer;
    wx.navigateTo({
      url: `/pages/chat/chat?openid=${openid}`,
    });
  },

  // 拨打电话
  phone(e) {
    const phone = e.currentTarget.dataset.phone;
    if (phone) {
      wx.makePhoneCall({ phoneNumber: phone });
    }
  },
});
