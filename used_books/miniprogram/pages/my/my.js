const app = getApp();
const config = require("../../config.js");
const LoginCheck = require("../../utils/login-check.js");

Page({

      /**
       * 页面的初始数据
       */
      data: {
            showShare: false,
            poster: JSON.parse(config.data).share_poster,
      },
      onShow() {
            this.setData({
                  userinfo: app.userinfo
            })
      },
      go(e) {
            const { go: url, needLogin } = e.currentTarget.dataset;
            
            // 检查是否需要登录
            if (needLogin === 'true' || needLogin === true) {
                  const success = LoginCheck.check(() => {
                        // 已登录，执行原操作
                        wx.navigateTo({
                              url: url
                        });
                  }, {
                        toastMessage: '该功能需要登录后使用'
                  });
                  if (!success) {
                        return false;
                  }
            } else {
                  // 不需要登录的操作
                  wx.navigateTo({
                        url: url
                  });
            }
      },
      
      // 展示分享弹窗
      showShare() {
            this.setData({
                  showShare: true
            });
      },
      //关闭弹窗
      closePop() {
            this.setData({
                  showShare: false,
            });
      },
      //预览图片
      preview(e) {
            wx.previewImage({
                  urls: e.currentTarget.dataset.link.split(",")
            });
      },
      onShareAppMessage() {
            return {
                  title: JSON.parse(config.data).share_title,
                  imageUrl: JSON.parse(config.data).share_img,
                  path: '/pages/start/start'
            }

      },
})
