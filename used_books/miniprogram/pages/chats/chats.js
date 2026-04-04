const app = getApp();
const LoginCheck = require("../../utils/login-check.js");
let db;

Page({
  data: {
    conversations: [],
    loading: true,
  },

  onLoad() {
    // 检查登录状态
    if (!LoginCheck.isLoggedIn()) {
      LoginCheck.check(() => {
        // 登录成功后加载数据
        this.loadData();
      }, {
        toastMessage: '查看消息需要登录后使用'
      });
      return;
    }
    
    this.loadData();
  },

  // 加载数据
  loadData() {
    // 等待云开发初始化完成后再执行
    app.ensureCloudReady().then(() => {
      db = wx.cloud.database();
      this.getConversations();
    });
  },

  onShow() {
    this.getConversations();
  },

  // 获取会话列表
  getConversations() {
    if (!app.openid) {
      this.setData({ loading: false });
      return;
    }

    db.collection('conversations')
      .where({
        participants: db.command.all([app.openid])
      })
      .orderBy('lastTime', 'desc')
      .get()
      .then(res => {
        this.setData({ conversations: res.data, loading: false });
      })
      .catch(err => {
        console.error('获取会话列表失败', err);
        this.setData({ loading: false });
      });
  },

  // 跳转聊天
  goChat(e) {
    const { id, name, avatar } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/chat/chat?id=${id}&name=${name}&avatar=${avatar}`,
    });
  },

  // 预览头像
  previewAvatar(e) {
    wx.previewImage({
      urls: [e.currentTarget.dataset.avatar],
    });
  },
});
