const app = getApp()
const config = require("../../config.js");

Page({
      data: {
            count: 3,
            bgurl: '/images/startBg.jpg' // 默认背景图
      },
      
      onLoad() {
            // 直接开始倒计时，不依赖云开发
            this.countDown();
            
            // 尝试获取云资源（静默失败）
            app.ensureCloudReady().then(() => {
                  const db = wx.cloud.database();
                  this.getimg(db);
                  this.getuserdetail(db);
            }).catch(err => {
              console.log('云开发暂不可用，使用默认配置');
            });
      },
      
      go() {
            wx.switchTab({
                  url: '/pages/index/index',
            })
      },
      
      countDown() {
            let that = this;
            let total = 3;
            this.interval = setInterval(function() {
                  total > 0 && (total--, that.setData({
                        count: total
                  })), 0 === total && (that.setData({
                        count: total
                  }), wx.switchTab({
                        url: "/pages/index/index"
                  }), clearInterval(that.interval));
            }, 1000);
      },
      
      //获取用户信息
      getuserdetail(db) {
            if (!app.openid) {
                  wx.cloud.callFunction({
                        name: 'regist',
                        data: {
                              $url: "getid",
                        },
                        success: re => {
                              if (re.result) {
                                    db.collection('user').where({
                                          _openid: re.result
                                    }).get({
                                          success: function(res) {
                                                if (res.data.length !== 0) {
                                                      app.openid = re.result;
                                                      app.userinfo = res.data[0];
                                                }
                                          }
                                    })
                              }
                        },
                        fail: err => {
                              console.log('云函数暂不可用');
                        }
                  })
            }
      },
      
      //获取背景图
      getimg(db) {
            let that = this;
            db.collection('start').get({
                  success: function(res) {
                        if (res.data.length > 0 && res.data[0].url) {
                              that.setData({
                                    bgurl: res.data[0].url
                              })
                        }
                  },
                  fail() {
                        // 使用默认背景图，静默失败
                        console.log('使用默认启动图');
                  }
            })
      },
      
      onUnload() {
            if (this.interval) {
                  clearInterval(this.interval);
            }
      }
})