const config = require("config.js");
const { data } = JSON.parse(config.data);

App({
  openid: '',
  userinfo: '',
  canReflect: true,
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      return;
    }
    wx.cloud.init({
      env: data.env,
      traceUser: true,
    });
    this.systeminfo = wx.getSystemInfoSync();
    this.globalData = data; // 缓存配置，避免其他页面重复 JSON.parse
  }
});
