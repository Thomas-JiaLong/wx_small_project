/**
 * 聊天详情页
 */
const app = getApp();
const LoginCheck = require("../../utils/login-check.js");
let db, _;

Page({
  data: {
    conversationId: '',
    otherName: '',
    otherAvatar: '',
    otherOpenid: '',
    messages: [],
    inputValue: '',
    scrollTop: 0,
    loading: true,
    pageLoading: false,
    hasMore: true,
    page: 0,
    pageSize: 20,
    openid: '',
    userInfo: null,
  },

  onLoad(options) {
    const { id, name, avatar, openid } = options;
    
    this.setData({
      conversationId: id,
      otherName: decodeURIComponent(name || ''),
      otherAvatar: decodeURIComponent(avatar || ''),
      otherOpenid: decodeURIComponent(openid || ''),
    });

    // 检查登录
    if (!LoginCheck.isLoggedIn()) {
      LoginCheck.check(() => {
        this.initData();
      }, { toastMessage: '请先登录' });
      return;
    }
    
    this.initData();
  },

  initData() {
    app.ensureCloudReady().then(() => {
      db = wx.cloud.database();
      _ = db.command;
      this.setData({ openid: app.openid });
      this.getMessages();
      this.markAsRead();
      this.watchMessages();
    });
  },

  onShow() {
    if (this.data.conversationId && db) {
      this.getMessages();
      this.markAsRead();
    }
  },

  onUnload() {
    // 取消监听
    if (this._watcher) {
      this._watcher.close();
    }
  },

  // 监听消息变化（实时更新）
  watchMessages() {
    if (this._watcher) {
      this._watcher.close();
    }
    
    this._watcher = db.collection('messages')
      .where({ conversationId: this.data.conversationId })
      .orderBy('createTime', 'desc')
      .limit(1)
      .watch({
        onChange: (snapshot) => {
          if (snapshot.docChanges.length > 0) {
            // 有新消息
            const change = snapshot.docChanges[0];
            if (change.doc.senderId !== this.data.openid) {
              // 他人消息，刷新并标记已读
              this.getMessages();
              this.markAsRead();
            }
          }
        },
        onError: (err) => {
          console.error('监听消息失败', err);
        }
      });
  },

  // 获取消息列表
  getMessages() {
    const { page, pageSize, messages } = this.data;
    
    db.collection('messages')
      .where({ conversationId: this.data.conversationId })
      .orderBy('createTime', 'asc')
      .limit(pageSize)
      .get()
      .then(res => {
        // 格式化时间
        const formattedMessages = res.data.map(msg => ({
          ...msg,
          timeFormat: this.formatTime(msg.createTime),
        }));

        this.setData({
          messages: page === 0 ? formattedMessages : [...messages, ...formattedMessages],
          hasMore: res.data.length === pageSize,
          loading: false,
          pageLoading: false,
        });
        
        // 滚动到底部
        if (page === 0) {
          this.scrollToBottom();
        }
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

  // 格式化时间
  formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    const pad = n => n < 10 ? '0' + n : n;
    
    if (msgDate.getTime() === today.getTime()) {
      // 今天，只显示时间
      return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    } else if (msgDate.getTime() === today.getTime() - 86400000) {
      // 昨天
      return `昨天 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    } else {
      // 其他日期
      return `${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }
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

    this.setData({ inputValue: '' });

    // 创建消息
    const messageData = {
      conversationId: this.data.conversationId,
      senderId: app.openid,
      senderName: app.userinfo?.info?.nickName || '我',
      senderAvatar: app.userinfo?.info?.avatarUrl || '',
      type: 'text',
      content: content,
      createTime: Date.now(),
      read: false,
    };

    db.collection('messages').add({
      data: messageData,
    }).then(() => {
      // 更新会话最后消息
      this.updateConversation(content);
      // 刷新消息列表
      this.getMessages();
    }).catch(err => {
      console.error('发送失败', err);
      wx.showToast({ title: '发送失败', icon: 'none' });
      // 恢复输入
      this.setData({ inputValue: content });
    });
  },

  // 更新会话最后消息
  updateConversation(lastMsg) {
    db.collection('conversations').doc(this.data.conversationId).update({
      data: {
        lastMsg: lastMsg,
        lastTime: Date.now(),
        [`unreadMap.${app.openid}`]: 0,
      }
    }).catch(err => {
      console.error('更新会话失败', err);
    });
  },

  // 标记已读
  markAsRead() {
    db.collection('messages')
      .where({
        conversationId: this.data.conversationId,
        senderId: _.neq(app.openid),
        read: false,
      })
      .update({
        data: { read: true },
      })
      .catch(err => {
        console.error('标记已读失败', err);
      });
  },

  // 滚动到底部
  scrollToBottom() {
    setTimeout(() => {
      this.setData({ scrollTop: this.data.messages.length * 10000 });
    }, 100);
  },

  // 返回
  goBack() {
    wx.navigateBack();
  },

  // 预览图片
  previewImage(e) {
    wx.previewImage({
      urls: [e.currentTarget.dataset.url],
    });
  },

  // 选择图片发送
  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.uploadAndSendImage(tempFilePath);
      },
    });
  },

  // 上传图片并发送
  uploadAndSendImage(filePath) {
    wx.showLoading({ title: '发送中...' });
    
    // 上传到云存储
    const extName = filePath.match(/\.[^.]+$/)?.[0] || '.jpg';
    const cloudPath = `chat/${this.data.conversationId}/${Date.now()}${extName}`;

    wx.cloud.uploadFile({
      cloudPath,
      filePath,
      success: (uploadRes) => {
        const imageUrl = uploadRes.fileID;
        
        // 创建消息
        db.collection('messages').add({
          data: {
            conversationId: this.data.conversationId,
            senderId: app.openid,
            senderName: app.userinfo?.info?.nickName || '我',
            senderAvatar: app.userinfo?.info?.avatarUrl || '',
            type: 'image',
            content: imageUrl,
            createTime: Date.now(),
            read: false,
          },
        }).then(() => {
          wx.hideLoading();
          this.updateConversation('[图片]');
          this.getMessages();
        }).catch(() => {
          wx.hideLoading();
          wx.showToast({ title: '发送失败', icon: 'none' });
        });
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '上传失败', icon: 'none' });
      },
    });
  },
});
