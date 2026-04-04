const app = getApp();
const config = require("../../config.js");
const LoginCheck = require("../../utils/login-check.js");

Page({
  data: {
    // ==================== 步骤状态 ====================
    active: 0,
    
    // ==================== ISBN ====================
    isbn: '',
    isbnMode: 'scan',  // 'scan' 扫码模式, 'manual' 手动模式
    
    // ==================== 书籍信息（扫码获取或手动填写） ====================
    bookinfo: null,
    manualBook: {
      isbn: '',
      title: '',
      author: '',
      edition: '',
      price: '',
      pic: '',
    },
    
    // ==================== 发布信息 ====================
    price: 15,
    dura: 30,
    place: '',
    notes: '',
    note_counts: 0,
    cids: -1,
    kindid: 0,
    chooseCollege: false,
    chooseDelivery: 0,
    
    // ==================== 选项数据 ====================
    college: JSON.parse(config.data).college.slice(1),
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
    }).catch(() => {
      wx.showToast({ title: '云开发暂不可用', icon: 'none' });
    });
  },

  // 恢复初始状态
  initial() {
    this.setData({
      active: 0,
      isbn: '',
      isbnMode: 'scan',
      bookinfo: null,
      manualBook: { isbn: '', title: '', author: '', edition: '', price: '', pic: '' },
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

  // ==================== ISBN 输入（扫码模式下可手动输入） ====================
  isbnInput(e) {
    this.setData({ isbn: e.detail.value });
  },

  // 扫码
  scan() {
    if (!LoginCheck.isLoggedIn()) {
      LoginCheck.check(() => this.doScan(), { toastMessage: '扫码需要登录' });
      return;
    }
    this.doScan();
  },

  doScan() {
    wx.scanCode({
      onlyFromCamera: false,
      scanType: ['barCode'],
      success: res => {
        const isbn = res.result.trim();
        if (/^(978|979)\d{10}$/.test(isbn)) {
          wx.showToast({ title: '扫码成功', icon: 'success' });
          this.setData({ isbn });
          this.confirm(); // 自动确认
        } else {
          wx.showToast({ title: '非ISBN条码，请手动输入', icon: 'none' });
          this.setData({ isbn });
        }
      },
      fail: () => {
        wx.showToast({ title: '扫码失败，可手动输入', icon: 'none' });
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
      wx.showToast({ title: 'ISBN格式不正确（13位）', icon: 'none' });
      return;
    }

    if (!LoginCheck.isLoggedIn()) {
      LoginCheck.check(() => this.getBook(isbn), { toastMessage: '确认ISBN需要登录' });
      return;
    }

    this.getBook(isbn);
  },

  // 获取书籍信息（扫码模式）
  getBook(isbn) {
    wx.showLoading({ title: '查询中...', mask: true });

    // 1. 先查本地云数据库
    this.db.collection('books').where({ isbn }).get()
      .then(res => {
        if (res.data.length > 0) {
          // 本地已有
          wx.hideLoading();
          this.onBookFound(res.data[0]);
          return;
        }
        // 2. 查云函数（豆瓣API）
        return this.fetchFromAPI(isbn);
      })
      .catch(() => {
        wx.hideLoading();
        wx.showToast({ title: '查询失败', icon: 'none' });
      });
  },

  // 从云函数获取书籍信息
  fetchFromAPI(isbn) {
    return wx.cloud.callFunction({
      name: 'books',
      data: { $url: 'bookinfo', isbn }
    })
    .then(res => {
      if (res.result && res.result.body && res.result.body.status == 0) {
        const bookData = res.result.body.result;
        // 保存到云数据库
        return this.db.collection('books').add({ data: bookData })
          .then(() => bookData);
      }
      throw new Error('not_found');
    })
    .then(bookData => {
      wx.hideLoading();
      this.onBookFound(bookData);
    })
    .catch(err => {
      wx.hideLoading();
      if (err.message === 'not_found') {
        // 扫码成功但无数据 → 进入手动填写模式
        wx.showToast({ title: '未找到图书信息，请手动填写', icon: 'none', duration: 2000 });
        setTimeout(() => {
          this.enterManualMode(isbn);
        }, 1500);
      } else {
        wx.showToast({ title: '查询失败，请手动填写', icon: 'none' });
        setTimeout(() => {
          this.enterManualMode(isbn);
        }, 1500);
      }
    });
  },

  // 扫码获取到书籍 → 直接进入步骤2
  onBookFound(bookData) {
    this.setData({
      bookinfo: bookData,
      isbnMode: 'scan',
      active: 1,
    });
    wx.pageScrollTo({ scrollTop: 0 });
  },

  // 进入手动填写模式（ISBN只读）
  enterManualMode(isbn) {
    this.setData({
      isbn,
      isbnMode: 'manual',
      active: 1,
      'manualBook.isbn': isbn,
    });
    wx.pageScrollTo({ scrollTop: 0 });
  },

  // ==================== 手动模式表单输入 ====================
  manualInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`manualBook.${field}`]: e.detail.value });
  },

  manualTitle(e) { this.setData({ 'manualBook.title': e.detail.value }); }
  manualAuthor(e) { this.setData({ 'manualBook.author': e.detail.value }); }
  manualEdition(e) { this.setData({ 'manualBook.edition': e.detail.value }); }
  manualPrice(e) { this.setData({ 'manualBook.price': e.detail.value }); },

  // 手动模式选择图片
  chooseBookPic() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: res => {
        wx.showLoading({ title: '上传中...', mask: true });
        const filePath = res.tempFilePaths[0];
        const ext = filePath.match(/\.[^.]+$/)[0];
        const cloudPath = `bookCovers/${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;

        wx.cloud.uploadFile({
          cloudPath,
          filePath,
        })
        .then(up => {
          wx.hideLoading();
          this.setData({ 'manualBook.pic': up.fileID });
          wx.showToast({ title: '上传成功', icon: 'success' });
        })
        .catch(() => {
          wx.hideLoading();
          wx.showToast({ title: '上传失败', icon: 'none' });
        });
      }
    });
  },

  // 手动模式提交 → 保存书籍信息到云DB，再进入步骤2
  submitManual() {
    const { isbn, title, author, edition, price, pic } = this.data.manualBook;

    // 必填校验
    if (!title.trim()) {
      wx.showToast({ title: '请填写书名', icon: 'none' });
      return;
    }
    if (!author.trim()) {
      wx.showToast({ title: '请填写作者', icon: 'none' });
      return;
    }
    if (!price.trim() || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
      wx.showToast({ title: '请填写正确的定价', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中...', mask: true });

    const bookData = {
      isbn,
      title: title.trim(),
      author: author.trim(),
      edition: edition.trim() || '',
      price: parseFloat(price),
      pic: pic || 'https://img9.doubanio.com/f/shire/55250dd82382206f5961b6d0a89c843f853d4c95/pics/book-default-medium.gif',
      creat: Date.now(),
    };

    // 保存到云数据库 books 集合
    this.db.collection('books').add({ data: bookData })
      .then(res => {
        bookData._id = res._id;
        wx.hideLoading();
        wx.showToast({ title: '保存成功', icon: 'success' });
        this.setData({ bookinfo: bookData });
      })
      .catch(() => {
        wx.hideLoading();
        wx.showToast({ title: '保存失败', icon: 'none' });
      });
  },

  // ==================== 步骤2 - 发布信息填写 ====================

  // 价格调整
  priceInput(e) {
    this.setData({ price: parseFloat(e.detail.value) || 0 });
  },
  decreasePrice() {
    if (this.data.price > 1) this.setData({ price: this.data.price - 1 });
  },
  increasePrice() {
    if (this.data.price < 999) this.setData({ price: this.data.price + 1 });
  },

  // 天数调整
  decreaseDura() {
    if (this.data.dura > 1) this.setData({ dura: this.data.dura - 1 });
  },
  increaseDura() {
    if (this.data.dura < 99) this.setData({ dura: this.data.dura + 1 });
  },

  placeInput(e) { this.setData({ place: e.detail.value }); },

  noteInput(e) {
    this.setData({ notes: e.detail.value, note_counts: e.detail.cursor });
  },

  kindSelect(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({
      kind: this.data.kind.map(i => ({ ...i, check: i.id === id })),
      kindid: id,
      chooseCollege: id === 1,
      cids: id === 0 ? -1 : this.data.cids,
    });
  },

  choCollege(e) {
    this.setData({ cids: parseInt(e.detail.value) });
  },

  delSelect(e) {
    const id = parseInt(e.currentTarget.dataset.id);
    this.setData({
      delivery: this.data.delivery.map(i => ({ ...i, check: i.id === id })),
      chooseDelivery: id,
    });
  },

  // 发布前校验
  check_pub() {
    // 专业书必须选学院
    if (this.data.kind[1].check && this.data.cids === -1) {
      wx.showToast({ title: '请选择学院', icon: 'none' });
      return;
    }
    // 自提必须填地址
    if (this.data.delivery[0].check && !this.data.place.trim()) {
      wx.showToast({ title: '请输入自提地址', icon: 'none' });
      return;
    }
    this.publish();
  },

  publish() {
    const { bookinfo } = this.data;
    const title = bookinfo?.title || this.data.manualBook?.title || '未命名';
    
    wx.showModal({
      title: '确认发布',
      content: `《${title}》售价 ¥${this.data.price}`,
      success: res => {
        if (res.confirm) this.doPublish();
      }
    });
  },

  // 执行发布
  doPublish() {
    if (!this.db) {
      wx.showToast({ title: '云开发暂不可用', icon: 'none' });
      return;
    }

    const { bookinfo, price, kindid, cids, chooseDelivery, place, notes, dura, manualBook, isbnMode } = this.data;

    // 获取书籍信息
    let bookData;
    if (isbnMode === 'scan') {
      bookData = {
        _id: bookinfo._id,
        author: bookinfo.author,
        edition: bookinfo.edition,
        pic: bookinfo.pic,
        price: bookinfo.price,
        title: bookinfo.title,
      };
    } else {
      bookData = {
        _id: bookinfo._id,
        author: manualBook.author || '',
        edition: manualBook.edition || '',
        pic: manualBook.pic || '',
        price: parseFloat(manualBook.price) || 0,
        title: manualBook.title || '',
      };
    }

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
        bookinfo: bookData,
        key: bookData.title + (bookinfo.keyword || ''),
        isbn: isbnMode === 'manual' ? manualBook.isbn : (bookinfo.isbn || ''),
      }
    })
    .then(res => {
      wx.hideLoading();
      this.setData({ active: 2, detail_id: res._id });
      wx.pageScrollTo({ scrollTop: 0 });
    })
    .catch(() => {
      wx.hideLoading();
      wx.showToast({ title: '发布失败', icon: 'none' });
    });
  },

  detail() {
    wx.navigateTo({ url: '/pages/detail/detail?scene=' + this.data.detail_id });
  },

  // 返回步骤1重新选择
  goBack() {
    this.setData({ active: 1 });
    wx.pageScrollTo({ scrollTop: 0 });
  },

  // 从按钮进入手动模式
  enterManualModeFromBtn() {
    // 弹出输入框让用户输入ISBN
    wx.showModal({
      title: '手动输入ISBN',
      editable: true,
      placeholderText: '请输入ISBN（13位数字）',
      success: res => {
        if (res.confirm && res.content) {
          const isbn = res.content.trim();
          if (/^(978|979)\d{10}$/.test(isbn)) {
            this.enterManualMode(isbn);
          } else {
            wx.showToast({ title: 'ISBN格式不正确', icon: 'none' });
          }
        }
      }
    });
  },
});
