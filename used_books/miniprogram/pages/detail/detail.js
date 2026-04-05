const app = getApp()
const config = require("../../config.js");
let db, _;
Page({

      /**
       * 页面的初始数据
       */
      data: {
            first_title: true,
            place: '',
      },
      onLoad(e) {
            // 等待云开发初始化完成后再执行
            app.ensureCloudReady().then(() => {
                  db = wx.cloud.database();
                  _ = db.command;
                  this.getuserdetail();
                  this.data.id = e.scene;
                  this.getPublish(e.scene);
                  this.getdetail();
            });
      },
      changeTitle(e) {
            let that = this;
            that.setData({
                  first_title: e.currentTarget.dataset.id
            })
      },
      //获取发布信息
      getPublish(e) {
            let that = this;
            db.collection('publish').doc(e).get({
                  success: function (res) {
                        console.log("获取发布的图书价格:", res.data.price)
                        that.setData({
                              collegeName: JSON.parse(config.data).college[parseInt(res.data.collegeid) + 1],
                              publishinfo: res.data
                        })
                        if (res.data.bookinfo && res.data.bookinfo._id) {
                              that.getSeller(res.data._openid, res.data.bookinfo._id)
                        } else {
                              console.log("书籍信息不完整")
                        }
                  }
            })
      },
      //获取卖家信息
      getSeller(m, n) {
            let that = this;
            db.collection('user').where({
                  _openid: m
            }).get({
                  success: function (res) {
                        console.log("res", res)
                        console.log("获取卖家openid:")
                        console.log(res.data[0]._openid)
                        console.log("获取卖家钱包数值(元):")
                        console.log(res.data[0].parse)
                        that.setData({
                              publisherinfo: res.data[0],//存储卖家信息
                              userinfo: app.userinfo //存储用户信息

                        })
                        console.log("获取user的openid:")
                        console.log(app.userinfo._openid)
                        console.log("获取user的钱包数值(元):")
                        console.log(app.userinfo.parse)
                        that.getBook(n)
                  }
            })
      },
      //获取书本信息
      getBook(n) {
            let that = this;
            //利用书本唯一 _id 获取书本信息的云数据库表 books 所有信息. 
            db.collection('books').doc(n).get({
                  success: function (n) {
                        that.setData({
                              bookinfo: n.data
                        })
                  }, fail: function (err) {
                        console.log("获取书本信息失败", err)
                  }
            })
      },
      //回到首页
      home() {
            wx.switchTab({
                  url: '/pages/index/index',
            })
      },
      getdetail() {
            let that = this;

            db.collection('user').where({
                  _openid: app.openid
            }).get({
                  success: function (res) {
                        let info = res.data[0]
                        that.setData({
                              _id: info._id
                        })
                  },
                  fail() {
                        wx.showToast({
                              title: '获取失败',
                              icon: 'none'
                        })
                        let e = setTimeout(
                              wx.navigateBack({}), 2000
                        )
                  }
            })
      },
      //购买检测
      buy(e) {
            let that = this;
            if (!app.openid) {
                  wx.showModal({
                        title: '温馨提示',
                        content: '该功能需要注册方可使用，是否马上去注册',
                        success(res) {
                              if (res.confirm) {
                                    wx.navigateTo({
                                          url: '/pages/login/login',
                                    })
                              }
                        }
                  })
                  return false
            }
            if (that.data.publishinfo.deliveryid == 1) {
                  if (that.data.place == '') {
                        wx.showToast({
                              title: '请输入您的收货地址',
                              icon: 'none'
                        })
                        return false
                  }

                  that.getStatus();
            }
            that.getStatus();
      },
      //获取订单状态
      getStatus() {
            let that = this;
            let _id = that.data.publishinfo._id;
            var _openid = that.data.userinfo._openid;
            db.collection('publish').doc(_id).get({
                  success(e) {
                        if (e.data.status == 0) {
                              that.paypost();
                        } else {
                              wx.showToast({
                                    title: '该书刚刚被抢光了~',
                                    icon: 'none'
                              })
                        }
                  }
            })
      },
      //支付提交 - 改进版：通过云函数处理
      paypost() {
            let that = this;
            var userParse = that.data.userinfo.parse || 0;
            var publishPrice = that.data.publishinfo.price || 0;

            // 检查余额
            if (userParse < publishPrice) {
                  wx.showModal({
                        title: '温馨提示',
                        content: '余额不足，是否立即充值？',
                        cancelText: '取消',
                        confirmText: '充值',
                        success(res) {
                              if (res.confirm) {
                                    wx.navigateTo({
                                          url: '/pages/recharge/recharge',
                                    })
                              }
                        }
                  })
                  return false
            }

            wx.showLoading({
                  title: '正在下单...',
            });

            // 调用云函数创建订单并扣款（在服务端完成，更安全）
            wx.cloud.callFunction({
                  name: 'order',
                  data: {
                        $url: 'create',
                        publishId: that.data.publishinfo._id,
                        price: publishPrice,
                        bookinfo: {
                              _id: that.data.bookinfo._id,
                              title: that.data.bookinfo.title,
                              author: that.data.bookinfo.author,
                              pic: that.data.bookinfo.pic,
                              edition: that.data.bookinfo.edition,
                        },
                        deliveryid: that.data.publishinfo.deliveryid,
                        ztplace: that.data.publishinfo.place,
                        psplace: that.data.place,
                        sellerOpenid: that.data.publishinfo._openid,
                  },
                  success: function (res) {
                        wx.hideLoading();
                        console.log('创建订单结果:', res);

                        if (res.result && res.result.success) {
                              // 订单创建成功，更新本地用户信息
                              app.userinfo.parse = res.result.data.newBalance;
                              
                              wx.showToast({
                                    title: '购买成功',
                                    icon: 'success'
                              });

                              // 跳转成功页
                              setTimeout(() => {
                                    wx.redirectTo({
                                          url: '/pages/success/success?id=' + res.result.data.orderId,
                                    })
                              }, 1500);
                        } else {
                              wx.showToast({
                                    title: res.result?.message || '购买失败',
                                    icon: 'none'
                              });
                        }
                  },
                  fail: function (err) {
                        wx.hideLoading();
                        console.error('创建订单失败:', err);
                        wx.showToast({
                              title: '购买失败，请稍后再试',
                              icon: 'none'
                        });
                  }
            });
      },

      //联系对方
      contactUser() {
            const { publishinfo, publisherinfo } = this.data;
            
            // 不能和自己聊天
            if (publishinfo._openid === app.openid) {
                  wx.showToast({ title: '这是您发布的书籍', icon: 'none' });
                  return;
            }
            
            if (!app.openid) {
                  wx.showModal({
                        title: '温馨提示',
                        content: '该功能需要登录后方可使用',
                        success: res => {
                              if (res.confirm) {
                                    wx.navigateTo({ url: '/pages/login/login' });
                              }
                        }
                  });
                  return;
            }
            
            wx.showLoading({ title: '正在打开聊天...' });
            
            // 调用云函数获取或创建会话
            wx.cloud.callFunction({
                  name: 'chat',
                  data: {
                        $url: 'getOrCreate',  // 指定路由
                        sellerId: publishinfo._openid,
                        bookId: publishinfo._id,
                        bookTitle: publishinfo.bookinfo?.title || '书籍',
                  },
                  success: res => {
                        wx.hideLoading();
                        if (res.result && res.result.success) {
                              const conv = res.result.data;
                              // 跳转到聊天页面
                              wx.navigateTo({
                                    url: `/pages/chat/chat?id=${conv._id}&name=${encodeURIComponent(conv.otherName)}&avatar=${encodeURIComponent(conv.otherAvatar)}&openid=${encodeURIComponent(conv.otherOpenid)}`,
                              });
                        } else {
                              wx.showToast({ title: res.result?.message || '打开聊天失败', icon: 'none' });
                        }
                  },
                  fail: err => {
                        wx.hideLoading();
                        wx.showToast({ title: '打开聊天失败', icon: 'none' });
                  }
            });
      },

      //地址输入
      placeInput(e) {
            this.data.place = e.detail.value
      },
      onShareAppMessage() {
            return {
                  title: '这本《' + this.data.bookinfo.title + '》只要￥' + this.data.publishinfo.price + '，快来看看吧',
                  path: '/pages/detail/detail?scene=' + this.data.publishinfo._id,
            }
      },
      //生成海报
      creatPoster() {
            let that = this;
            let pubInfo = {
                  id: that.data.publishinfo._id,
                  name: that.data.publishinfo.bookinfo.title,
                  pic: that.data.publishinfo.bookinfo.pic.replace('http', 'https'),
                  origin: that.data.publishinfo.bookinfo.price,
                  now: that.data.publishinfo.price,
            }
            wx.navigateTo({
                  url: "/pages/poster/poster?bookinfo=" + JSON.stringify(pubInfo)
            })
      },
      //客服跳动动画
      kefuani: function () {
            let that = this;
            let animationKefuData = wx.createAnimation({
                  duration: 1000,
                  timingFunction: 'ease',
            });
            animationKefuData.translateY(10).step({ duration: 800 }).translateY(0).step({ duration: 800 });
            that.setData({ animationKefuData: animationKefuData.export() });
            setInterval(function () {
                  animationKefuData.translateY(20).step({ duration: 800 }).translateY(0).step({ duration: 800 });
                  that.setData({ animationKefuData: animationKefuData.export() });
            }.bind(that), 1800);
      },
      onReady() {
            this.kefuani();
      }
})
