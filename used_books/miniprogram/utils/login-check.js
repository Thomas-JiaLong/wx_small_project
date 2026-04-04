const app = getApp();

// 存储登录成功后的回调函数
let loginCallback = null;

class LoginCheck {
  /**
   * 检查登录状态
   * @returns {boolean} 是否已登录
   */
  static isLoggedIn() {
    return !!app.openid && !!app.userinfo;
  }

  /**
   * 登录检查中间件
   * @param {Function} callback 登录成功后的回调函数
   * @param {Object} options 选项
   * @param {boolean} options.showToast 是否显示提示
   * @param {string} options.toastMessage 提示消息
   * @returns {boolean} 是否已登录
   */
  static check(callback, options = {}) {
    const { showToast = true, toastMessage = '该功能需要登录后使用' } = options;

    if (!this.isLoggedIn()) {
      if (showToast) {
        wx.showModal({
          title: '登录提示',
          content: toastMessage,
          success: (res) => {
            if (res.confirm) {
              // 保存回调函数，登录成功后执行
              if (callback && typeof callback === 'function') {
                loginCallback = callback;
              }
              // 跳转到登录页面
              wx.navigateTo({
                url: '/pages/login/login'
              });
            } else {
              // 用户取消登录，清除回调
              loginCallback = null;
              console.log('用户取消登录');
            }
          }
        });
      } else {
        // 保存回调函数，登录成功后执行
        if (callback && typeof callback === 'function') {
          loginCallback = callback;
        }
        // 直接跳转到登录页面
        wx.navigateTo({
          url: '/pages/login/login'
        });
      }
      return false;
    }

    // 已登录，执行回调
    if (callback && typeof callback === 'function') {
      callback();
    }
    return true;
  }

  /**
   * 执行登录成功后的回调
   */
  static executeCallback() {
    if (loginCallback && typeof loginCallback === 'function') {
      const callback = loginCallback;
      loginCallback = null; // 清除回调
      callback();
    }
  }

  /**
   * 清除登录回调
   */
  static clearCallback() {
    loginCallback = null;
  }

  /**
   * 强制登录
   * @returns {Promise<boolean>} 登录是否成功
   */
  static async forceLogin() {
    return new Promise((resolve) => {
      if (this.isLoggedIn()) {
        resolve(true);
        return;
      }

      wx.showModal({
        title: '登录提示',
        content: '请先登录',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/login/login',
              success: () => {
                resolve(false);
              },
              fail: () => {
                resolve(false);
              }
            });
          } else {
            resolve(false);
          }
        },
        fail: () => {
          resolve(false);
        }
      });
    });
  }

  /**
   * 跳转到登录页面
   * @param {string} redirectUrl 登录成功后跳转的地址
   */
  static gotoLogin(redirectUrl = '') {
    wx.navigateTo({
      url: `/pages/login/login?redirect=${encodeURIComponent(redirectUrl)}`
    });
  }

  /**
   * 登录成功后处理
   * @param {Object} userInfo 用户信息
   */
  static loginSuccess(userInfo) {
    app.userinfo = userInfo;
    app.openid = userInfo._openid;

    // 显示登录成功提示
    wx.showToast({
      title: '登录成功',
      icon: 'success',
      duration: 1500
    });

    // 返回到上一页
    setTimeout(() => {
      wx.navigateBack();
    }, 1500);
  }
}

module.exports = LoginCheck;
