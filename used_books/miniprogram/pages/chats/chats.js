const db = wx.cloud.database();
const app = getApp();

Page({
  data: {
    conversations: [],
    loading: true,
  },

  onLoad() {
    this.getConversations();
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
