/**
 * 消息列表页（会话列表）
 */
const app = getApp();
const LoginCheck = require("../../utils/login-check.js");
let db, _;

Page({
  data: {
    conversations: [],
    loading: true,
    openid: '',
  },

  onLoad() {
    // 检查登录状态
    if (!LoginCheck.isLoggedIn()) {
      LoginCheck.check(() => {
        this.initData();
      }, { toastMessage: '查看消息需要登录后使用' });
      return;
    }
    this.initData();
  },

  initData() {
    app.ensureCloudReady().then(() => {
      db = wx.cloud.database();
      _ = db.command;
      this.setData({ openid: app.openid });
      this.getConversations();
      this.watchConversations();
    });
  },

  onShow() {
    if (db && this.data.openid) {
      this.getConversations();
    }
  },

  onUnload() {
    if (this._watcher) {
      this._watcher.close();
    }
  },

  // 监听会话变化
  watchConversations() {
    if (this._watcher) {
      this._watcher.close();
    }

    this._watcher = db.collection('conversations')
      .where({
        participants: _.all([this.data.openid])
      })
      .orderBy('lastTime', 'desc')
      .watch({
        onChange: (snapshot) => {
          if (snapshot.docChanges.length > 0) {
            this.getConversations();
          }
        },
        onError: (err) => {
          console.error('监听会话失败', err);
        }
      });
  },

  // 获取会话列表
  getConversations() {
    if (!app.openid) {
      this.setData({ loading: false });
      return;
    }

    db.collection('conversations')
      .where({
        participants: _.all([app.openid])
      })
      .orderBy('lastTime', 'desc')
      .get()
      .then(res => {
        // 格式化会话数据
        const conversations = res.data.map(conv => {
          // 获取对方的名字和头像
          const otherOpenid = conv.participants.find(id => id !== app.openid);
          const otherName = conv.participantNames?.[otherOpenid] || '用户';
          const otherAvatar = conv.participantAvatars?.[otherOpenid] || '';
          
          // 计算未读数
          const unreadMap = conv.unreadMap || {};
          const unread = unreadMap[app.openid] || 0;
          
          return {
            ...conv,
            _id: conv._id,
            otherOpenid,
            name: otherName,
            avatar: otherAvatar,
            lastMsg: conv.lastMsg || '暂无消息',
            lastTimeFormat: this.formatTime(conv.lastTime),
            unread: unread,
            bookTitle: conv.bookTitle || '',
          };
        });

        this.setData({ 
          conversations: conversations, 
          loading: false 
        });
      })
      .catch(err => {
        console.error('获取会话列表失败', err);
        this.setData({ loading: false });
      });
  },

  // 格式化时间
  formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    const pad = n => n < 10 ? '0' + n : n;
    
    if (msgDate.getTime() === today.getTime()) {
      return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    } else if (msgDate.getTime() === today.getTime() - 86400000) {
      return '昨天';
    } else if (msgDate.getTime() > today.getTime() - 604800000) {
      // 一周内
      const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      return days[date.getDay()];
    } else {
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }
  },

  // 跳转聊天
  goChat(e) {
    const { id, name, avatar, openid } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/chat/chat?id=${id}&name=${encodeURIComponent(name)}&avatar=${encodeURIComponent(avatar || '')}&openid=${encodeURIComponent(openid || '')}`,
    });
  },

  // 删除会话
  deleteConversation(e) {
    const id = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '删除会话',
      content: '确定删除此会话吗？',
      success: res => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          
          // 删除会话
          db.collection('conversations').doc(id).remove()
            .then(() => {
              // 删除该会话下的所有消息
              return db.collection('messages')
                .where({ conversationId: id })
                .remove();
            })
            .then(() => {
              wx.hideLoading();
              wx.showToast({ title: '已删除', icon: 'success' });
              this.getConversations();
            })
            .catch(() => {
              wx.hideLoading();
              wx.showToast({ title: '删除失败', icon: 'none' });
            });
        }
      }
    });
  },

  // 预览头像
  previewAvatar(e) {
    const avatar = e.currentTarget.dataset.avatar;
    if (avatar) {
      wx.previewImage({
        urls: [avatar],
      });
    }
  },
});
