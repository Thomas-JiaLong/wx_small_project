/**
 * 提现页面
 */
const app = getApp();
const config = require('../../config.js');
let db, _;

Page({
  data: {
    num: 0,          // 当前余额
    key: '',          // 输入的提现金额
    userid: '',       // 用户ID
    times: 1,         // 当日已提现次数（1=已达上限，0=可提现）
    canReflect: false, // 是否可提现（防抖）
    loading: false,
  },

  onLoad() {
    app.ensureCloudReady().then(() => {
      db = wx.cloud.database();
      _ = db.command;
      this.refresh();
    });
  },

  // 刷新余额和提现次数
  async refresh() {
    this.setData({ loading: true });
    try {
      const [userRes, timesRes] = await Promise.all([
        db.collection('user').where({ _openid: app.openid }).get(),
        this.getTodayTimes(),
      ]);

      const user = userRes.data[0];
      const times = timesRes.total || 0;

      this.setData({
        num: user ? user.parse : 0,
        userid: user ? user._id : '',
        times: times,
        canReflect: times === 0 && app.canReflect,
        loading: false,
      });
    } catch (e) {
      console.error('获取数据失败:', e);
      this.setData({ loading: false });
    }
  },

  // 获取当日提现次数
  async getTodayTimes() {
    try {
      return await db.collection('times')
        .where({
          _openid: app.openid,
          days: config.days()
        })
        .count();
    } catch (e) {
      return { total: 0 };
    }
  },

  // 金额输入
  keyInput(e) {
    this.setData({ key: e.detail.value });
  },

  // 提现校验
  check() {
    let that = this;
    let key = that.data.key.trim();
    let num = parseFloat(key);

    // 防抖检查
    if (!app.canReflect) {
      wx.showToast({ title: '操作太频繁，请稍后再试', icon: 'none' });
      return;
    }

    // 检查今日提现次数
    if (that.data.times > 0) {
      wx.showToast({ title: '每日仅限提现一次，请明日再来', icon: 'none' });
      return;
    }

    // 金额校验
    if (!key || isNaN(num) || num <= 0) {
      wx.showToast({ title: '请输入正确的提现金额', icon: 'none' });
      return;
    }

    if (num < 10) {
      wx.showToast({ title: '单笔提现金额不得低于10元', icon: 'none' });
      return;
    }

    if (num > 30) {
      wx.showToast({ title: '单笔提现金额不得超过30元', icon: 'none' });
      return;
    }

    if (num > that.data.num) {
      wx.showToast({ title: '余额不足', icon: 'none' });
      return;
    }

    // 确认提现
    wx.showModal({
      title: '确认提现',
      content: `确定要提现 ¥${num} 到微信钱包吗？`,
      success: res => {
        if (res.confirm) {
          that.reflectpost(num);
        }
      }
    });
  },

  // 记录提现次数
  async addTimes() {
    try {
      await db.collection('times').add({
        data: {
          _openid: app.openid,
          days: config.days(),
          stamp: new Date().getTime(),
        }
      });
    } catch (e) {
      console.error('记录提现次数失败:', e);
    }
  },

  // 提现提交
  async reflectpost(amount) {
    let that = this;
    app.canReflect = false;
    that.setData({ canReflect: false });

    wx.showLoading({ title: '提现中...' });

    try {
      const res = await wx.cloud.callFunction({
        name: 'ref',
        data: {
          userid: that.data.userid,
          num: amount,
        }
      });

      wx.hideLoading();

      if (res.result && res.result.success) {
        // 提现成功
        that.addTimes();
        that.setData({
          num: that.data.num - amount,
          times: 1,
          key: '',
        });
        wx.showToast({ title: '提现成功', icon: 'success' });
      } else {
        // 提现失败
        app.canReflect = true;
        that.setData({ canReflect: true });
        wx.showToast({
          title: res.result?.message || '提现失败，请稍后重试',
          icon: 'none'
        });
      }
    } catch (err) {
      wx.hideLoading();
      app.canReflect = true;
      that.setData({ canReflect: true });
      console.error('提现失败:', err);
      wx.showToast({ title: '提现失败，请稍后重试', icon: 'none' });
    }
  },
});
