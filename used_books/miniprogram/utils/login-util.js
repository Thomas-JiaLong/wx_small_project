const app = getApp();
const config = require("../config.js");

class LoginUtil {
  static async login() {
    try {
      // 1. 调用小程序官方登录接口
      const loginResult = await this.wxLogin();
      
      // 2. 获取用户信息（使用新的授权方式）
      const userInfoResult = await this.getUserProfile();
      
      // 3. 保存用户信息到全局
      app.userinfo = userInfoResult.userInfo;
      app.openid = loginResult.code; // 暂时使用code作为openid，实际应该通过云函数获取
      
      // 4. 检查是否需要选择校区
      await this.checkCampus();
      
      return {
        success: true,
        userInfo: userInfoResult.userInfo,
        openid: loginResult.code
      };
    } catch (error) {
      console.error('登录失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 小程序官方登录
  static wxLogin() {
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
  }

  // 获取用户信息（新的授权方式）
  static getUserProfile() {
    return new Promise((resolve, reject) => {
      wx.getUserProfile({
        desc: '用于完善用户信息',
        success: (res) => {
          resolve(res);
        },
        fail: (err) => {
          reject(new Error('获取用户信息失败：' + err.errMsg));
        }
      });
    });
  }

  // 检查是否需要选择校区
  static async checkCampus() {
    const userinfo = app.userinfo;
    
    if (!userinfo || !userinfo.campus) {
      // 显示校区选择弹窗
      await this.showCampusSelect();
    }
  }

  // 显示校区选择弹窗
  static showCampusSelect() {
    return new Promise((resolve) => {
      const campusList = JSON.parse(config.data).campus;
      
      wx.showActionSheet({
        itemList: campusList.map(item => item.name),
        success: (res) => {
          const selectedIndex = res.tapIndex;
          const selectedCampus = campusList[selectedIndex];
          
          // 更新用户信息
          app.userinfo = {
            ...app.userinfo,
            campus: selectedCampus
          };
          
          // 保存到数据库
          this.saveUserInfo(app.userinfo);
          resolve(selectedCampus);
        },
        fail: () => {
          resolve(null);
        }
      });
    });
  }

  // 保存用户信息到数据库
  static async saveUserInfo(userInfo) {
    try {
      await app.ensureCloudReady();
      const db = wx.cloud.database();
      
      // 检查用户是否已存在
      const result = await db.collection('user')
        .where({ _openid: app.openid })
        .get();
      
      if (result.data.length > 0) {
        // 更新现有用户
        await db.collection('user')
          .doc(result.data[0]._id)
          .update({
            data: {
              info: userInfo,
              campus: userInfo.campus,
              updatedAt: Date.now()
            }
          });
      } else {
        // 创建新用户
        await db.collection('user').add({
          data: {
            campus: userInfo.campus,
            qqnum: '',
            email: '',
            wxnum: '',
            stamp: Date.now(),
            info: userInfo,
            useful: true,
            parse: 0
          }
        });
      }
    } catch (error) {
      console.error('保存用户信息失败:', error);
    }
  }

  // 检查登录状态
  static isLoggedIn() {
    return !!app.openid && !!app.userinfo;
  }

  // 强制登录（用于需要登录的场景）
  static async forceLogin() {
    if (!this.isLoggedIn()) {
      return await this.login();
    }
    return {
      success: true,
      userInfo: app.userinfo,
      openid: app.openid
    };
  }
}

module.exports = LoginUtil;
