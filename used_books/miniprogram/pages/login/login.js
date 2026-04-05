/**
 * 登录页面
 */
const app = getApp();
const config = require('../../config.js');
const LoginCheck = require('../../utils/login-check.js');

Page({
  data: {
    userInfo: {},
    campusIndex: 0,
    campus: JSON.parse(config.data).campus,
    agreed: false,
    isLoggingIn: false,
    showUserInfoForm: false,
    tempAvatarUrl: '',
    tempNickName: '',
  },

  db: null,

  onLoad() {
    app.ensureCloudReady().then(() => {
      this.db = wx.cloud.database();
    });
  },

  // 切换协议勾选
  toggleAgreement() {
    this.setData({ agreed: !this.data.agreed });
  },

  // 选择校区
  chooseCampus(e) {
    this.setData({ campusIndex: parseInt(e.detail.value) });
  },

  // 选择头像
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    this.setData({ tempAvatarUrl: avatarUrl });
  },

  // 输入昵称
  onNickNameInput(e) {
    this.setData({ tempNickName: e.detail.value });
  },

  // 微信快捷登录
  async wechatLogin() {
    if (this.data.isLoggingIn) return;

    // 检查是否已勾选协议
    if (!this.data.agreed) {
      wx.showToast({ title: '请阅读并同意用户协议和隐私政策', icon: 'none' });
      return;
    }

    // 如果需要完善信息
    if (this.data.showUserInfoForm) {
      if (!this.data.tempNickName.trim()) {
        wx.showToast({ title: '请输入昵称', icon: 'none' });
        return;
      }
      if (!this.data.tempAvatarUrl) {
        wx.showToast({ title: '请选择头像', icon: 'none' });
        return;
      }
      await this.doLogin();
      return;
    }

    this.setData({ isLoggingIn: true });

    try {
      // 1. 获取微信用户信息
      const userInfo = await this.getWxUserProfile();

      // 2. 如果昵称为空或默认微信用户，显示完善信息表单
      if (!userInfo.nickName || userInfo.nickName === '微信用户' || !userInfo.avatarUrl) {
        this.setData({
          showUserInfoForm: true,
          isLoggingIn: false,
        });
        wx.showToast({ title: '请完善头像和昵称', icon: 'none', duration: 2000 });
        return;
      }

      // 3. 执行登录
      await this.doLogin(userInfo);
    } catch (error) {
      console.error('微信登录失败:', error);
      const errMsg = error.errMsg || '';
      if (errMsg.includes('deny') || errMsg.includes('auth')) {
        wx.showToast({ title: '请授权后使用', icon: 'none' });
      } else {
        wx.showToast({ title: '登录失败，请重试', icon: 'none' });
      }
    } finally {
      this.setData({ isLoggingIn: false });
    }
  },

  // 获取微信用户信息
  getWxUserProfile() {
    return new Promise((resolve, reject) => {
      wx.getUserProfile({
        desc: '用于完善用户资料',
        success: (res) => resolve(res.userInfo),
        fail: reject,
      });
    });
  },

  // 执行登录
  async doLogin(wxUserInfo = null) {
    this.setData({ isLoggingIn: true });

    try {
      // 1. 通过云函数获取真实的 openid（安全方式）
      const openidRes = await wx.cloud.callFunction({
        name: 'regist',
        data: { $url: 'getid' },
      });

      if (!openidRes.result || !openidRes.result.openid) {
        throw new Error('获取用户身份失败');
      }

      const realOpenid = openidRes.result.openid;

      // 2. 构建用户信息
      let userInfo;
      if (this.data.showUserInfoForm) {
        userInfo = {
          nickName: this.data.tempNickName,
          avatarUrl: this.data.tempAvatarUrl,
        };
      } else {
        userInfo = wxUserInfo || { nickName: '微信用户' };
      }

      // 3. 查询用户是否已存在（按真实 openid）
      const userResult = await this.db.collection('user')
        .where({ _openid: realOpenid })
        .get();

      let userData;

      if (userResult.data && userResult.data.length > 0) {
        // 老用户登录：更新基本信息
        const existingUser = userResult.data[0];
        await this.db.collection('user')
          .doc(existingUser._id)
          .update({
            data: {
              info: userInfo,
              updatedAt: Date.now(),
            }
          });
        userData = { ...existingUser, info: userInfo };
      } else {
        // 新用户注册：创建用户记录
        const selectedCampus = this.data.campus[this.data.campusIndex];
        const addResult = await this.db.collection('user').add({
          data: {
            _openid: realOpenid,       // 真实的 openid（云开发自动注入）
            campus: selectedCampus,
            qqnum: '',
            email: '',
            wxnum: '',
            stamp: Date.now(),
            info: userInfo,
            useful: true,
            parse: 0,                  // 初始钱包余额为0
          }
        });

        const newUser = await this.db.collection('user')
          .doc(addResult._id)
          .get();
        userData = newUser.data;
      }

      // 4. 保存到全局
      app.userinfo = userData;
      app.openid = realOpenid;

      // 5. 登录成功
      wx.showToast({ title: '登录成功', icon: 'success', duration: 1500 });

      setTimeout(() => {
        wx.navigateBack({
          success: () => setTimeout(() => LoginCheck.executeCallback(), 300),
          fail: () => LoginCheck.executeCallback(),
        });
      }, 1500);

    } catch (error) {
      console.error('登录失败:', error);
      wx.showToast({ title: '登录失败：' + (error.message || '请重试'), icon: 'none' });
    } finally {
      this.setData({ isLoggingIn: false });
    }
  },

  // 跳转到用户协议
  goToAgreement() {
    wx.navigateTo({ url: '/pages/agreement/agreement?type=user' });
  },

  // 跳转到隐私政策
  goToPrivacy() {
    wx.navigateTo({ url: '/pages/agreement/agreement?type=privacy' });
  },
});
