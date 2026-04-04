const app = getApp();
const config = require("../../config.js");
const LoginCheck = require("../../utils/login-check.js");
let db, _;

Page({
  data: {
    showBackTop: false,
    newlist: [],
    list: [],
    key: '',
    blank: false,
    hislist: [],
    nomore: false,
    page: 0,
    loading: false,
  },

  _backTopTimer: null,

  onLoad() {
    app.ensureCloudReady().then(() => {
      db = wx.cloud.database();
      _ = db.command;
      this.gethis();
      this.getnew();
    });
  },

  // 获取搜索历史
  gethis() {
    wx.getStorage({
      key: 'history',
      success: res => {
        let hislist = JSON.parse(res.data);
        if (hislist.length > 5) hislist.length = 5;
        this.setData({ hislist });
      },
    });
  },

  // 选择历史关键词
  choosekey(e) {
    this.setData({ key: e.currentTarget.dataset.key });
    this.search('his');
  },

  // 最新推荐
  getnew() {
    db.collection('publish')
      .where({ status: 0, dura: _.gt(Date.now()) })
      .orderBy('creat', 'desc')
      .limit(5)
      .get()
      .then(res => {
        this.setData({ newlist: res.data });
      })
      .catch(() => {});
  },

  // 跳转详情
  detail(e) {
    wx.navigateTo({
      url: '/pages/detail/detail?scene=' + e.currentTarget.dataset.id,
    });
  },

  // 搜索
  search(n) {
    const key = this.data.key.trim();
    if (!key) {
      wx.showToast({ title: '请输入关键词', icon: 'none' });
      return;
    }

    if (!LoginCheck.isLoggedIn()) {
      LoginCheck.check(() => this.doSearch(n), {
        toastMessage: '搜索功能需要登录后使用'
      });
      return;
    }

    this.doSearch(n);
  },

  // 执行搜索
  doSearch(n) {
    const key = this.data.key;
    wx.setNavigationBarTitle({ title: `"${key}"的搜索结果` });
    wx.showLoading({ title: '加载中', mask: true });

    if (n !== 'his') this.history(key);

    db.collection('publish')
      .where({
        status: 0,
        dura: _.gt(Date.now()),
        key: db.RegExp({ regexp: '.*' + key + '.*', options: 'i' }),
      })
      .orderBy('creat', 'desc')
      .limit(20)
      .get()
      .then(e => {
        wx.hideLoading();
        this.setData({
          blank: true,
          page: 0,
          list: e.data,
          nomore: e.data.length < 20,
        });
      })
      .catch(() => {
        wx.hideLoading();
        wx.showToast({ title: '搜索失败', icon: 'none' });
      });
  },

  // 搜索历史记录
  history(key) {
    wx.getStorage({
      key: 'history',
      success: res => {
        const oldarr = JSON.parse(res.data);
        const newarr = [key, ...oldarr.filter(i => i !== key)].slice(0, 10);
        wx.setStorage({ key: 'history', data: JSON.stringify(newarr) });
      },
      fail: () => {
        wx.setStorage({ key: 'history', data: JSON.stringify([key]) });
      },
    });
  },

  // 输入
  keyInput(e) {
    this.setData({ key: e.detail.value });
  },

  // 滚动监听（节流）
  onPageScroll(e) {
    if (!this._backTopTimer) {
      this.setData({ showBackTop: e.scrollTop > 500 });
      this._backTopTimer = setTimeout(() => { this._backTopTimer = null; }, 300);
    }
  },

  // 回到顶部
  gotop() {
    wx.pageScrollTo({ scrollTop: 0, duration: 300 });
  },

  // 加载更多
  more() {
    if (this.data.nomore || this.data.loading || this.data.list.length < 20) return;

    const nextPage = this.data.page + 1;
    this.setData({ loading: true });

    db.collection('publish')
      .where({
        status: 0,
        dura: _.gt(Date.now()),
        key: db.RegExp({ regexp: '.*' + this.data.key + '.*', options: 'i' }),
      })
      .orderBy('creat', 'desc')
      .skip(nextPage * 20)
      .limit(20)
      .get()
      .then(res => {
        this.setData({
          loading: false,
          nomore: res.data.length < 20,
          page: nextPage,
          list: this.data.list.concat(res.data),
        });
      })
      .catch(() => {
        this.setData({ loading: false });
        wx.showToast({ title: '加载失败', icon: 'none' });
      });
  },

  onReachBottom() {
    this.more();
  },
});
