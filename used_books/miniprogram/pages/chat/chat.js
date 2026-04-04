const db = wx.cloud.database();
const app = getApp();

Page({
  data: {
    conversationId: '',
    otherName: '',
    otherAvatar: '',
    messages: [],
    inputValue: '',
    scrollTop: 0,
    loading: true,
    pageLoading: false,
    hasMore: true,
    page: 0,
    pageSize: 20,
  },

  onLoad(options) {
    const { id, name, avatar } = options;
    this.setData({
      conversationId: id,
      otherName: decodeURIComponent(name || ''),
      otherAvatar: decodeURIComponent(avatar || ''),
    });
    
    if (app.openid) {
      this.getMessages();
      this.markAsRead();
    }
  },

  onShow() {
    // 每次显示时刷新消息
    if (this.data.conversationId) {
      this.getMessages();
    }
  },

  // 获取消息列表
  getMessages() {
    const { page, pageSize, messages } = this.data;
    
    db.collection('messages')
      .where({
        conversationId: this.data.conversationId,
      })
      .orderBy('createTime', 'desc')
      .skip(page * pageSize)
      .limit(pageSize)
      .get()
      .then(res => {
        const newMessages = res.data.reverse();
        this.setData({
          messages: page === 0 ? newMessages : [...messages, ...newMessages],
          hasMore: res.data.length === pageSize,
          loading: false,
          pageLoading: false,
        });
        this.scrollToBottom();
      })
      .catch(err => {
        console.error('获取消息失败', err);
        this.setData({ loading: false, pageLoading: false });
      });
  },

  // 加载更多历史消息
  loadMore() {
    if (this.data.pageLoading || !this.data.hasMore) return;
    
    this.setData({ pageLoading: true, page: this.data.page + 1 });
    this.getMessages();
  },

  // 监听输入
  onInput(e) {
    this.setData({ inputValue: e.detail.value });
  },

  // 发送消息
  sendMessage() {
    const content = this.data.inputValue.trim();
    if (!content) {
      wx.showToast({ title: '请输入内容', icon: 'none' });
      return;
    }

    if (!app.openid) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    const message = {
      conversationId: this.data.conversationId,
      senderId: app.openid,
      type: 'text',
      content: content,
      createTime: Date.now(),
      read: false,
    };

    // 先清空输入框
    this.setData({ inputValue: '' });

    // 发送到数据库
    db.collection('messages').add({
      data: message,
    }).then(() => {
      // 更新会话最后消息
      this.updateConversation(content);
      // 刷新消息列表
      this.getMessages();
    }).catch(err => {
      console.error('发送失败', err);
      wx.showToast({ title: '发送失败', icon: 'none' });
    });
  },

  // 更新会话最后消息
  updateConversation(lastMsg) {
    db.collection('conversations').doc(this.data.conversationId).update({
      data: {
        lastMsg: lastMsg,
        lastTime: Date.now(),
      }
    });
  },

  // 标记已读
  markAsRead() {
    db.collection('messages')
      .where({
        conversationId: this.data.conversationId,
        senderId: db.command.neq(app.openid),
        read: false,
      })
      .update({
        data: { read: true },
      });
      
    // 更新会话未读数
    db.collection('conversations').doc(this.data.conversationId).update({
      data: { unread: 0 },
    });
  },

  // 滚动到底部
  scrollToBottom() {
    setTimeout(() => {
      this.setData({ scrollTop: this.data.messages.length * 1000 });
    }, 100);
  },

  // 预览图片
  previewImage(e) {
    wx.previewImage({
      urls: [e.currentTarget.dataset.url],
    });
  },
});
