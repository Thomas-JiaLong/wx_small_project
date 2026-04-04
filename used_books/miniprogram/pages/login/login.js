const app = getApp();
const config = require("../../config.js");
const LoginCheck = require("../../utils/login-check.js");

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
            }).catch(err => {
                  console.log('云开发暂不可用');
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

            // 如果已经在完善信息表单页面，检查信息是否填写完整
            if (this.data.showUserInfoForm) {
                  if (!this.data.tempNickName.trim()) {
                        wx.showToast({ title: '请输入昵称', icon: 'none' });
                        return;
                  }
                  if (!this.data.tempAvatarUrl) {
                        wx.showToast({ title: '请选择头像', icon: 'none' });
                        return;
                  }
                  // 执行登录
                  this.doLogin();
                  return;
            }

            this.setData({ isLoggingIn: true });

            try {
                  // 1. 调用微信官方接口获取用户信息
                  const userInfo = await this.getWxUserProfile();
                  
                  // 2. 检查获取到的用户信息
                  if (!userInfo.nickName || userInfo.nickName === '微信用户' || !userInfo.avatarUrl) {
                        // 需要用户手动填写信息
                        this.setData({
                              showUserInfoForm: true,
                              isLoggingIn: false,
                              tempNickName: '',
                              tempAvatarUrl: ''
                        });
                        wx.showToast({ 
                              title: '请完善头像和昵称', 
                              icon: 'none',
                              duration: 2000
                        });
                        return;
                  }

                  // 3. 执行登录
                  await this.doLogin(userInfo);
            } catch (error) {
                  console.error('微信登录失败', error);
                  // 用户拒绝授权或其他错误
                  if (error.errMsg && error.errMsg.includes('deny')) {
                        wx.showToast({ title: '请授权后使用', icon: 'none' });
                  } else {
                        wx.showToast({ title: '登录失败，请重试', icon: 'none' });
                  }
            } finally {
                  this.setData({ isLoggingIn: false });
            }
      },

      // 获取微信用户信息 - 主动调用（需要用户触发）
      getWxUserProfile() {
            return new Promise((resolve, reject) => {
                  wx.getUserProfile({
                        desc: '用于完善用户资料',
                        success: (res) => {
                              console.log('获取用户信息成功:', res.userInfo);
                              this.setData({ userInfo: res.userInfo });
                              resolve(res.userInfo);
                        },
                        fail: (err) => {
                              console.error('获取用户信息失败:', err);
                              reject(err);
                        }
                  });
            });
      },

      // 执行登录
      async doLogin(wxUserInfo = null) {
            this.setData({ isLoggingIn: true });

            try {
                  // 构建用户信息
                  let userInfo;
                  if (this.data.showUserInfoForm) {
                        // 使用用户手动填写的信息
                        userInfo = {
                              nickName: this.data.tempNickName,
                              avatarUrl: this.data.tempAvatarUrl,
                              gender: 0,
                              language: '',
                              city: '',
                              province: '',
                              country: ''
                        };
                  } else {
                        // 使用微信获取的信息
                        userInfo = wxUserInfo;
                  }

                  // 1. 调用小程序登录获取code
                  const loginRes = await this.wxLogin();
                  
                  // 2. 检查用户是否已存在
                  const userResult = await this.db.collection('user')
                        .where({ _openid: loginRes.code })
                        .get();
                  
                  let userData;
                  if (userResult.data.length > 0) {
                        // 更新现有用户
                        await this.db.collection('user')
                              .doc(userResult.data[0]._id)
                              .update({
                                    data: {
                                          info: userInfo,
                                          updatedAt: Date.now()
                                    }
                              });
                        userData = userResult.data[0];
                  } else {
                        // 创建新用户
                        const selectedCampus = this.data.campus[this.data.campusIndex];
                        const addResult = await this.db.collection('user').add({
                              data: {
                                    campus: selectedCampus,
                                    qqnum: '',
                                    email: '',
                                    wxnum: '',
                                    stamp: Date.now(),
                                    info: userInfo,
                                    useful: true,
                                    parse: 0
                              }
                        });
                        const newUser = await this.db.collection('user')
                              .doc(addResult._id)
                              .get();
                        userData = newUser.data;
                  }

                  // 3. 保存用户信息到全局
                  app.userinfo = userData;
                  app.openid = userData._openid;

                  // 4. 登录成功
                  wx.showToast({
                        title: '登录成功',
                        icon: 'success',
                        duration: 1500
                  });

                  setTimeout(() => {
                        // 先返回到上一页
                        wx.navigateBack({
                              success: () => {
                                    // 页面返回成功后执行回调
                                    setTimeout(() => {
                                          LoginCheck.executeCallback();
                                    }, 300);
                              },
                              fail: () => {
                                    // 如果返回失败，仍然执行回调
                                    LoginCheck.executeCallback();
                              }
                        });
                  }, 1500);
            } catch (error) {
                  console.error('登录失败', error);
                  wx.showToast({ title: '登录失败，请重试', icon: 'none' });
            } finally {
                  this.setData({ isLoggingIn: false });
            }
      },

      // 小程序登录
      wxLogin() {
            return new Promise((resolve, reject) => {
                  wx.login({
                        success: (res) => {
                              if (res.code) {
                                    resolve(res);
                              } else {
                                    reject(new Error('登录失败：' + res.errMsg));
                              }
                        },
                        fail: (err) => {
                              reject(new Error('登录失败：' + err.errMsg));
                        }
                  });
            });
      },

      // 跳转到用户协议
      goToAgreement() {
            wx.navigateTo({
                  url: '/pages/agreement/agreement?type=user'
            });
      },

      // 跳转到隐私政策
      goToPrivacy() {
            wx.navigateTo({
                  url: '/pages/agreement/agreement?type=privacy'
            });
      }
})
