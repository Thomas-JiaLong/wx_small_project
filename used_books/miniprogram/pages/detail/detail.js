const app = getApp();
const config = require("../../config.js");
let db, _;

Page({
  data: {
    first_title: true,
    place: '',
    loading: true,
  },

  onLoad(e) {
    app.ensureCloudReady().then(() => {
      db = wx.cloud.database();
      _ = db.command;
      this.setData({ _id: e.scene });
      this.getuserdetail();
      this.getPublish(e.scene);
    });
  },

  // 切换标签
  changeTitle(e) {
    this.setData({ first_title: e.currentTarget.dataset.id });
  },

  // 获取发布信息
  getPublish(id) {
    db.collection('publish').doc(id).get()
      .then(res => {
        const collegeData = JSON.parse(config.data).college;
        this.setData({
          loading: false,
          collegeName: collegeData[parseInt(res.data.collegeid) + 1],
          publishinfo: res.data,
        });
        this.getSeller(res.data._openid, res.data.bookinfo._id);
      })
      .catch(err => {
        this.setData({ loading: false });
        wx.showToast({ title: '获取失败', icon: 'none' });
      });
  },

  // 获取卖家信息
  getSeller(openid, bookId) {
    db.collection('user').where({ _openid: openid }).get()
      .then(res => {
        if (res.data.length > 0) {
          this.setData({
            publisherinfo: res.data[0],
            userinfo: app.userinfo,
          });
        }
        return this.getBook(bookId);
      })
      .catch(() => {});
  },

  // 获取书本信息
  getBook(bookId) {
    db.collection('books').doc(bookId).get()
      .then(res => {
        this.setData({ bookinfo: res.data });
      })
      .catch(err => {
        console.log('获取书本信息失败:', err);
      });
  },

  // 获取用户详情
  getdetail() {
    if (!app.openid) return;
    db.collection('user').where({ _openid: app.openid }).get()
      .then(res => {
        if (res.data.length > 0) {
          this.setData({ _id: res.data[0]._id });
        }
      })
      .catch(() => {
        wx.showToast({ title: '请先登录', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 2000);
      });
  },

  // 回到首页
  home() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  // 路由跳转
  go(e) {
    wx.navigateTo({ url: e.currentTarget.dataset.go });
  },

  // 地址输入
  placeInput(e) {
    this.setData({ place: e.detail.value });
  },

  // 购买
  buy() {
    if (!app.openid) {
      wx.showModal({
        title: '温馨提示',
        content: '该功能需要注册方可使用，是否马上去注册？',
        success: res => {
          if (res.confirm) wx.navigateTo({ url: '/pages/login/login' });
        }
      });
      return;
    }

    // 帮送需要填写地址
    if (this.data.publishinfo.deliveryid == 1 && !this.data.place.trim()) {
      wx.showToast({ title: '请输入您的收货地址', icon: 'none' });
      return;
    }

    this.getStatus();
  },

  // 获取订单状态
  getStatus() {
    db.collection('publish').doc(this.data.publishinfo._id).get()
      .then(e => {
        if (e.data.status == 0) {
          this.paypost();
        } else {
          wx.showToast({ title: '该书刚刚被抢光了~', icon: 'none' });
        }
      });
  },

  // 支付提交
  paypost() {
    const userParse = this.data.userinfo.parse;
    const publishPrice = this.data.publishinfo.price;

    if (userParse < publishPrice) {
      wx.showModal({
        title: '温馨提示',
        content: '余额不足，是否及时充值？',
        success: res => {
          if (res.confirm) wx.navigateTo({ url: '/pages/recharge/recharge' });
        }
      });
      return;
    }

    wx.showLoading({ title: '正在下单', mask: true });

    wx.cloud.callFunction({
      name: 'parse',
      data: {
        goodId: this.data.publishinfo._id,
        userParse,
        publishPrice,
      },
    })
    .then(res => this.pay(res.result.parse))
    .catch(err => {
      wx.hideLoading();
      wx.showToast({ title: '支付失败，请稍后再试', icon: 'none' });
    });
  },

  // 更新余额
  pay(newParse) {
    db.collection('user').doc(app.userinfo._id).update({
      data: {
        parse: newParse,
        updatedat: Date.now(),
      },
    })
    .then(() => {
      wx.showToast({ title: '购买成功', icon: 'success' });
      this.setStatus();
    })
    .catch(() => {
      wx.hideLoading();
      wx.showToast({ title: '购买失败，请稍后再试', icon: 'none' });
    });
  },

  // 修改在售状态
  setStatus() {
    wx.showLoading({ title: '正在处理', mask: true });

    wx.cloud.callFunction({
      name: 'pay',
      data: {
        $url: 'changeP',
        _id: this.data.publishinfo._id,
        status: 1,
      },
    })
    .then(() => this.creatOrder())
    .catch(() => {
      wx.hideLoading();
      wx.showToast({ title: '发生异常，请联系管理员', icon: 'none' });
    });
  },

  // 创建订单
  creatOrder() {
    db.collection('order').add({
      data: {
        creat: Date.now(),
        status: 1,
        price: this.data.publishinfo.price,
        deliveryid: this.data.publishinfo.deliveryid,
        ztplace: this.data.publishinfo.place,
        psplace: this.data.place,
        bookinfo: {
          _id: this.data.bookinfo._id,
          author: this.data.bookinfo.author,
          edition: this.data.bookinfo.edition,
          pic: this.data.bookinfo.pic,
          title: this.data.bookinfo.title,
        },
        seller: this.data.publishinfo._openid,
        sellid: this.data.publishinfo._id,
      },
    })
    .then(e => {
      this.history('购买书籍', this.data.publishinfo.price, 2, e._id);
    })
    .catch(() => {
      wx.hideLoading();
      wx.showToast({ title: '创建订单失败', icon: 'none' });
    });
  },

  // 历史记录
  history(name, num, type, id) {
    db.collection('history').add({
      data: {
        stamp: Date.now(),
        type: 1,
        name: '微信支付',
        num,
        oid: app.openid,
      },
    })
    .then(() => {
      return db.collection('history').add({
        data: {
          stamp: Date.now(),
          type,
          name,
          num,
          oid: app.openid,
        },
      });
    })
    .then(() => {
      wx.hideLoading();
      this.tip();
      wx.redirectTo({ url: '/pages/success/success?id=' + id });
    })
    .catch(() => wx.hideLoading());
  },

  // 邮件提醒
  tip() {
    wx.cloud.callFunction({
      name: 'email',
      data: {
        type: 1,
        email: this.data.publisherinfo.email,
        title: this.data.bookinfo.title,
      },
    }).catch(() => {});
  },

  // 获取用户信息
  getuserdetail() {
    if (app.openid) return;
    
    wx.cloud.callFunction({
      name: 'regist',
      data: { $url: 'getid' },
    })
    .then(re => {
      return db.collection('user').where({ _openid: re.result }).get();
    })
    .then(res => {
      if (res.data.length > 0) {
        app.openid = res.data[0]._openid;
        app.userinfo = res.data[0];
      }
    })
    .catch(() => {});
  },

  // 联系卖家
  contactSeller() {
    const { publishinfo, publisherinfo } = this.data;

    if (publishinfo._openid === app.openid) {
      wx.showToast({ title: '这是您发布的书籍', icon: 'none' });
      return;
    }

    if (!app.openid) {
      wx.showModal({
        title: '温馨提示',
        content: '该功能需要注册方可使用，是否马上去注册？',
        success: res => {
          if (res.confirm) wx.navigateTo({ url: '/pages/login/login' });
        }
      });
      return;
    }

    wx.showLoading({ title: '正在打开聊天...', mask: true });

    wx.cloud.callFunction({
      name: 'chat',
      data: {
        sellerId: publishinfo._openid,
        bookId: publishinfo._id,
        bookTitle: publishinfo.bookinfo.title,
      },
    })
    .then(res => {
      wx.hideLoading();
      if (res.result.success) {
        const conv = res.result.data;
        const name = publisherinfo.info?.nickName || '用户';
        const avatar = publisherinfo.info?.avatarUrl || '';
        wx.navigateTo({
          url: `/pages/chat/chat?id=${conv._id}&name=${encodeURIComponent(name)}&avatar=${encodeURIComponent(avatar)}`,
        });
      } else {
        wx.showToast({ title: '打开聊天失败', icon: 'none' });
      }
    })
    .catch(err => {
      wx.hideLoading();
      wx.showToast({ title: '打开聊天失败', icon: 'none' });
    });
  },

  // 生成海报
  creatPoster() {
    const pubInfo = {
      id: this.data.publishinfo._id,
      name: this.data.publishinfo.bookinfo.title,
      pic: this.data.publishinfo.bookinfo.pic.replace('http', 'https'),
      origin: this.data.publishinfo.bookinfo.price,
      now: this.data.publishinfo.price,
    };
    wx.navigateTo({
      url: '/pages/poster/poster?bookinfo=' + JSON.stringify(pubInfo),
    });
  },

  // 分享
  onShareAppMessage() {
    return {
      title: `这本《${this.data.bookinfo.title}》只要￥${this.data.publishinfo.price}V币`,
      path: '/pages/detail/detail?scene=' + this.data.publishinfo._id,
    };
  },

  onReady() {
    this.kefuani();
  },

  // 客服跳动动画
  kefuani() {
    const anim = wx.createAnimation({ duration: 800, timingFunction: 'ease' });
    anim.translateY(20).step().translateY(0).step().export();
    
    let frame = 0;
    setInterval(() => {
      anim.translateY(20).step({ duration: 800 }).translateY(0).step({ duration: 800 });
      this.setData({ animationKefuData: anim.export() });
      frame++;
    }, 1800);
  },
});
