const config = require("config.js");
const data = JSON.parse(config.data);

App({
  openid: '',
  userinfo: '',
  canReflect: true,
  globalData: null,
  systeminfo: null,
  
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      return;
    }
    
    // 初始化云开发
    try {
      wx.cloud.init({
        env: data.env,
        traceUser: true,
      });
      console.log('云开发初始化调用成功');
    } catch (err) {
      console.error('云开发初始化失败:', err);
    }
    
    this.systeminfo = wx.getSystemInfoSync();
    this.globalData = data;
  },
  
  // 等待云开发初始化完成的方法
  // 由于 wx.cloud.init 是同步调用，数据库连接在调用后立即可用
  // 这个方法主要确保在调用数据库前有一小段缓冲时间
  ensureCloudReady() {
    return new Promise((resolve) => {
      // 给云开发一个短暂的时间完成内部初始化
      setTimeout(() => {
        resolve();
      }, 50);
    });
  }
});
