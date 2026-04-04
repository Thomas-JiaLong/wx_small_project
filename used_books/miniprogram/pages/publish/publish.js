const app = getApp();
const config = require("../../config.js");
const LoginCheck = require("../../utils/login-check.js");

Page({
      data: {
            active: 0,
            college: JSON.parse(config.data).college.splice(1),
            isbn: '',
            bookinfo: null,
            price: 15,
            dura: 30,
            place: '',
            notes: '',
            note_counts: 0,
            cids: -1,
            kindid: 0,
            chooseCollege: false,
            chooseDelivery: 0,
            kind: [
                  { name: '通用', id: 0, check: true },
                  { name: '专业', id: 1, check: false }
            ],
            delivery: [
                  { name: '自提', id: 0, check: true },
                  { name: '帮送', id: 1, check: false }
            ],
      },
      
      db: null,

      onLoad() {
            app.ensureCloudReady().then(() => {
                  this.db = wx.cloud.database();
                  this.initial();
            }).catch(err => {
                  console.log('云开发暂不可用');
            });
      },

      // 恢复初始状态
      initial() {
            this.setData({
                  active: 0,
                  isbn: '',
                  bookinfo: null,
                  price: 15,
                  dura: 30,
                  place: '',
                  notes: '',
                  note_counts: 0,
                  cids: -1,
                  kindid: 0,
                  chooseCollege: false,
                  chooseDelivery: 0,
                  kind: [
                        { name: '通用', id: 0, check: true },
                        { name: '专业', id: 1, check: false }
                  ],
                  delivery: [
                        { name: '自提', id: 0, check: true },
                        { name: '帮送', id: 1, check: false }
                  ],
            });
      },

      // ISBN 输入
      isbnInput(e) {
            this.setData({ isbn: e.detail.value });
      },

      // 扫码
      scan() {
            // 检查登录状态
            if (!LoginCheck.isLoggedIn()) {
                  LoginCheck.check(() => {
                        // 登录成功后执行扫码
                        this.doScan();
                  }, {
                        toastMessage: '扫码功能需要登录后使用'
                  });
                  return;
            }
            
            this.doScan();
      },

      // 执行扫码
      doScan() {
            wx.scanCode({
                  onlyFromCamera: false,
                  scanType: ['barCode'],
                  success: res => {
                        wx.showToast({ title: '扫码成功', icon: 'success' });
                        this.setData({ isbn: res.result });
                  },
                  fail: () => {
                        wx.showToast({ title: '扫码失败，请手动输入', icon: 'none' });
                  }
            });
      },

      // 确认ISBN
      confirm() {
            if (!this.db) {
                  wx.showToast({ title: '云开发暂不可用', icon: 'none' });
                  return;
            }
            
            const isbn = this.data.isbn.trim();
            
            if (!/^(978|979)\d{10}$/.test(isbn)) {
                  wx.showToast({ title: 'ISBN格式不正确', icon: 'none' });
                  return;
            }
            
            // 检查登录状态
            if (!LoginCheck.isLoggedIn()) {
                  LoginCheck.check(() => {
                        // 登录成功后执行确认
                        this.getBook(isbn);
                  }, {
                        toastMessage: '确认ISBN需要登录后使用'
                  });
                  return;
            }
            
            this.getBook(isbn);
      },

      // 获取书籍信息
      getBook(isbn) {
            wx.showLoading({ title: '获取中...', mask: true });
            
            this.db.collection('books').where({ isbn }).get()
                  .then(res => {
                        if (res.data.length > 0) {
                              wx.hideLoading();
                              this.setData({
                                    bookinfo: res.data[0],
                                    active: 1
                              });
                        } else {
                              this.fetchBookFromCloud(isbn);
                        }
                  })
                  .catch(err => {
                        wx.hideLoading();
                        wx.showToast({ title: '查询失败', icon: 'none' });
                  });
      },

      // 从云端获取书籍信息
      fetchBookFromCloud(isbn) {
            wx.cloud.callFunction({
                  name: 'books',
                  data: { $url: "bookinfo", isbn }
            })
            .then(res => {
                  // 检查云函数返回状态
                  if (res.result && res.result.code !== 200) {
                        throw new Error(res.result.message || '获取图书信息失败');
                  }
                  // 检查API返回状态
                  if (res.result && res.result.body && res.result.body.status == 0) {
                        const bookData = res.result.body.result;
                        return this.db.collection('books').add({ data: bookData }).then(() => bookData);
                  }
                  throw new Error('未找到该书籍');
            })
            .then(bookData => {
                  wx.hideLoading();
                  this.setData({
                        bookinfo: bookData,
                        active: 1
                  });
            })
            .catch(err => {
                  wx.hideLoading();
                  console.error('获取书籍信息失败:', err);
                  wx.showToast({ title: err.message || '未找到该书籍', icon: 'none' });
            });
      },

      // 价格调整
      priceInput(e) {
            this.setData({ price: parseInt(e.detail.value) || 0 });
      },
      
      decreasePrice() {
            if (this.data.price > 1) {
                  this.setData({ price: this.data.price - 1 });
            }
      },
      
      increasePrice() {
            if (this.data.price < 999) {
                  this.setData({ price: this.data.price + 1 });
            }
      },

      // 展示天数调整
      decreaseDura() {
            if (this.data.dura > 1) {
                  this.setData({ dura: this.data.dura - 1 });
            }
      },
      
      increaseDura() {
            if (this.data.dura < 99) {
                  this.setData({ dura: this.data.dura + 1 });
            }
      },

      // 地址输入
      placeInput(e) {
            this.setData({ place: e.detail.value });
      },

      // 备注输入
      noteInput(e) {
            this.setData({
                  notes: e.detail.value,
                  note_counts: e.detail.cursor
            });
      },

      // 分类选择
      kindSelect(e) {
            const id = e.currentTarget.dataset.id;
            const kind = this.data.kind.map(item => ({
                  ...item,
                  check: item.id === id
            }));
            
            this.setData({
                  kind,
                  kindid: id,
                  chooseCollege: id === 1,
                  cids: id === 0 ? -1 : this.data.cids
            });
      },

      // 学院选择
      choCollege(e) {
            this.setData({ cids: parseInt(e.detail.value) });
      },

      // 取货方式选择
      delSelect(e) {
            const id = parseInt(e.currentTarget.dataset.id);
            const delivery = this.data.delivery.map(item => ({
                  ...item,
                  check: item.id === id
            }));
            
            this.setData({
                  delivery,
                  chooseDelivery: id
            });
      },

      // 发布前校验
      check_pub() {
            if (this.data.kind[1].check && this.data.cids === -1) {
                  wx.showToast({ title: '请选择学院', icon: 'none' });
                  return;
            }
            
            if (this.data.delivery[0].check && !this.data.place.trim()) {
                  wx.showToast({ title: '请输入自提地址', icon: 'none' });
                  return;
            }
            
            this.publish();
      },

      // 发布
      publish() {
            wx.showModal({
                  title: '确认发布',
                  content: `《${this.data.bookinfo.title}》售价 ¥${this.data.price}`,
                  success: res => {
                        if (res.confirm) {
                              this.doPublish();
                        }
                  }
            });
      },

      // 执行发布
      doPublish() {
            if (!this.db) {
                  wx.showToast({ title: '云开发暂不可用', icon: 'none' });
                  return;
            }
            
            const { bookinfo, price, kindid, cids, chooseDelivery, place, notes, dura } = this.data;
            
            wx.showLoading({ title: '发布中...', mask: true });
            
            this.db.collection('publish').add({
                  data: {
                        creat: Date.now(),
                        dura: Date.now() + dura * 24 * 60 * 60 * 1000,
                        status: 0,
                        price,
                        kindid,
                        collegeid: cids,
                        deliveryid: chooseDelivery,
                        place,
                        notes,
                        bookinfo: {
                              _id: bookinfo._id,
                              author: bookinfo.author,
                              edition: bookinfo.edition,
                              pic: bookinfo.pic,
                              price: bookinfo.price,
                              title: bookinfo.title,
                        },
                        key: bookinfo.title + (bookinfo.keyword || '')
                  }
            })
            .then(res => {
                  wx.hideLoading();
                  this.setData({
                        active: 2,
                        detail_id: res._id
                  });
                  wx.pageScrollTo({ scrollTop: 0 });
            })
            .catch(err => {
                  wx.hideLoading();
                  wx.showToast({ title: '发布失败', icon: 'none' });
            });
      },

      // 查看详情
      detail() {
            wx.navigateTo({
                  url: '/pages/detail/detail?scene=' + this.data.detail_id
            });
      },
      

});
