const app = getApp();
const config = require("../../config.js");

Page({
  data: {
    college: JSON.parse(config.data).college,
    collegeCur: -2,
    showList: false,
    showBackTop: false,
    nomore: false,
    list: [],
    banner: '',
    page: 0,
    loading: false,
  },

  db: null,
  _: null,
  _scrollTop: 0,
  _backTopTimer: null,

  onLoad() {
    app.ensureCloudReady().then(() => {
      this.db = wx.cloud.database();
      this._ = this.db.command;
      this.listkind();
      this.getbanner();
      this.getList();
    }).catch(() => {
      this.setData({ nomore: true, list: [] });
    });
  },

  // 滚动监听（节流优化，不再频繁setData）
  onPageScroll(e) {
    const scrollTop = e.scrollTop;
    this._scrollTop = scrollTop;
    
    // 节流：300ms 检测一次回到顶部按钮
    if (!this._backTopTimer) {
      const showBackTop = scrollTop > 500;
      if (this.data.showBackTop !== showBackTop) {
        this.setData({ showBackTop });
      }
      this._backTopTimer = setTimeout(() => {
        this._backTopTimer = null;
      }, 300);
    }
  },

  // 获取布局记忆
  listkind() {
    wx.getStorage({
      key: 'iscard',
      success: res => this.setData({ iscard: res.data }),
      fail: () => this.setData({ iscard: true })
    });
  },

  // 切换布局
  changeCard() {
    const iscard = !this.data.iscard;
    this.setData({ iscard });
    wx.setStorageSync('iscard', iscard);
  },

  // 跳转搜索
  search() {
    wx.navigateTo({ url: '/pages/search/search' });
  },

  // 学院选择
  collegeSelect(e) {
    const index = e.currentTarget.dataset.id;
    this.setData({
      collegeCur: index,
      scrollLeft: Math.max(0, index * 100 - 150),
      showList: false,
    });
    this.getList();
  },

  // 选择全部
  selectAll() {
    this.setData({ collegeCur: -2, scrollLeft: 0, showList: false });
    this.getList();
  },

  // 分类面板
  showlist() {
    this.setData({ showList: !this.data.showList });
  },

  // 获取书籍列表
  getList() {
    if (!this.db) return;

    const { collegeCur, college } = this.data;
    const _ = this._;
    const collegeid = collegeCur === -2 ? _.neq(-2) : (college[collegeCur].id + '');

    this.setData({ loading: true });

    this.db.collection('publish')
      .where({ status: 0, dura: _.gt(Date.now()), collegeid })
      .orderBy('creat', 'desc')
      .limit(20)
      .get()
      .then(res => {
        wx.stopPullDownRefresh();
        const { data } = res;
        this.setData({
          loading: false,
          nomore: data.length === 0 || data.length < 20,
          page: 0,
          list: data,
        });
      })
      .catch(() => {
        wx.stopPullDownRefresh();
        this.setData({ loading: false, nomore: true, list: [] });
      });
  },

  // 加载更多（Promise化）
  more() {
    if (!this.db || this.data.nomore || this.data.loading || this.data.list.length < 20) return;

    const { collegeCur, college, page } = this.data;
    const _ = this._;
    const collegeid = collegeCur === -2 ? _.neq(-2) : (college[collegeCur].id + '');
    const nextPage = page + 1;

    this.setData({ loading: true });

    this.db.collection('publish')
      .where({ status: 0, dura: _.gt(Date.now()), collegeid })
      .orderBy('creat', 'desc')
      .skip(nextPage * 20)
      .limit(20)
      .get()
      .then(res => {
        const more = res.data.length < 20;
        this.setData({
          loading: false,
          nomore: more,
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

  // 下拉刷新
  onPullDownRefresh() {
    this.getList();
  },

  // 回到顶部
  gotop() {
    wx.pageScrollTo({ scrollTop: 0, duration: 300 });
  },

  // 跳转详情
  detail(e) {
    wx.navigateTo({
      url: '/pages/detail/detail?scene=' + e.currentTarget.dataset.id,
    });
  },

  // 获取轮播图
  getbanner() {
    if (!this.db) return;
    this.db.collection('banner').get()
      .then(res => {
        if (res.data.length > 0) {
          this.setData({ banner: res.data[0].list });
        }
      })
      .catch(() => console.log('轮播图暂不可用'));
  },

  onShareAppMessage() {
    const cfg = JSON.parse(config.data);
    return {
      title: cfg.share_title,
      imageUrl: cfg.share_img,
      path: '/pages/start/start'
    };
  },
});
