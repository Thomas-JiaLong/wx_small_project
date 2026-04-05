/**
 * 钱包充值页面
 */
const app = getApp();
const config = require('../../config.js');
let db, _;

Page({
  data: {
    num: ''
  },

  onLoad() {
    app.ensureCloudReady().then(() => {
      db = wx.cloud.database();
      _ = db.command;
    });
  },

  // 金额输入
  numInput(e) {
    this.data.num = e.detail.value;
  },

  // 充值提交
  paypost() {
    let num = this.data.num.trim();
    if (!num || parseFloat(num) <= 0) {
      wx.showToast({ title: '请输入正确的金额', icon: 'none' });
      return;
    }
    const amount = parseFloat(num);
    if (amount > 10000) {
      wx.showToast({ title: '单次充值金额不得超过10000元', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '充值中...' });

    // 调用云函数直接充值
    wx.cloud.callFunction({
      name: 'pay',
      data: {
        $url: 'recharge',
        num: amount,
      },
      success: res => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          wx.showToast({ title: '充值成功', icon: 'success' });
          // 延迟返回上一页，让用户看到成功提示
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        } else {
          wx.showToast({
            title: res.result?.message || '充值失败',
            icon: 'none'
          });
        }
      },
      fail: err => {
        wx.hideLoading();
        console.error('充值失败:', err);
        wx.showToast({
          title: '充值失败，请稍后重试',
          icon: 'none'
        });
      }
    });
  },
});
