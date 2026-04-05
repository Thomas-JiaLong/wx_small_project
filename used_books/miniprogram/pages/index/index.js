const app = getApp();
const config = require('../../config.js');

// 窗口渲染常量
const CARD_HEIGHT = 384;    // 卡片模式每项高度 (rpx) = 240图+24p+20t+20p+12b ≈ 384
const LIST_HEIGHT = 308;     // 列表模式每项高度 (rpx) ≈ 180图+24p+16m ≈ 308
const BUFFER_COUNT = 3;      // 上下缓冲条目数
const FADE_DISTANCE = 50;    // 淡入淡出过渡距离 (rpx)

Page({
      data: {
            college: JSON.parse(config.data).college,
            collegeCur: -2,
            showList: false,
            scrollTop: 0,
            nomore: false,
            loadingMore: false,
            list: [],
            visibleItems: [],    // 窗口渲染的可见项
            topPlaceholder: 0,   // 上方占位高度
            bottomPlaceholder: 0, // 下方占位高度
            iscard: true,
            banner: ''
      },

      db: null,
      _: null,
      _systemInfo: null,
      _scrollTimer: null,
      _lastScrollTop: 0,
      _pageHeight: 0,

      onLoad() {
            // 缓存系统信息，避免每次都调用
            this._systemInfo = wx.getSystemInfoSync();
            this._pageHeight = this._systemInfo.windowHeight;

            app.ensureCloudReady().then(() => {
                  this.db = wx.cloud.database();
                  this._ = this.db.command;
                  this.listkind();
                  this.getbanner();
                  this.getList();
            }).catch(err => {
                  console.log('云开发暂不可用');
                  this.setData({ nomore: true, list: [], visibleItems: [] });
            });
      },

      onShow() {
            // 每次显示页面时检查是否有更新
            if (this.data.list.length > 0) {
                  this._updateVisibleItems(this._lastScrollTop);
            }
      },

      onPageScroll: function (e) {
            const scrollTop = e.scrollTop;
            // 移动端节流，阈值 50px
            if (Math.abs(scrollTop - this._lastScrollTop) < 50 && this._scrollTimer) {
                  return;
            }
            this._lastScrollTop = scrollTop;

            clearTimeout(this._scrollTimer);
            this._scrollTimer = setTimeout(() => {
                  this._updateVisibleItems(scrollTop);
            }, 16); // ~60fps
      },

      // ==================== 窗口渲染核心逻辑 ====================

      _getItemHeight() {
            return this.data.iscard ? CARD_HEIGHT : LIST_HEIGHT;
      },

      _updateVisibleItems(scrollTop) {
            const { list, iscard } = this.data;
            if (!list || list.length === 0) {
                  this.setData({ visibleItems: [], topPlaceholder: 0, bottomPlaceholder: 0 });
                  return;
            }

            // 转换 rpx → px（按屏幕宽度）
            const itemHeight = this._getItemHeight() * this._systemInfo.windowWidth / 750;
            const fadeDist = FADE_DISTANCE * this._systemInfo.windowWidth / 750;
            const windowH = this._pageHeight;

            // 计算可视范围（px）
            const startIdx = Math.floor(scrollTop / itemHeight);
            const visibleCount = Math.ceil(windowH / itemHeight) + 2;
            const from = Math.max(0, startIdx - BUFFER_COUNT);
            const to = Math.min(list.length, startIdx + visibleCount + BUFFER_COUNT);

            // 收集要渲染的项
            const visibleItems = [];
            for (let i = from; i < to; i++) {
                  const item = { ...list[i] };
                  const itemTop = i * itemHeight;
                  const itemCenter = itemTop + itemHeight / 2;
                  const viewCenter = scrollTop + windowH / 2;
                  const dist = Math.abs(itemCenter - viewCenter);

                  // 可见区域外的项标记透明/隐藏
                  if (dist > windowH / 2 + fadeDist) {
                        item._visible = false;
                        item._opacity = 0;
                        item._offsetY = 0;
                  } else {
                        item._visible = true;
                        // 越靠近中心越清晰
                        const ratio = Math.max(0, 1 - dist / (windowH / 2 + fadeDist));
                        item._opacity = 0.3 + ratio * 0.7; // 0.3~1.0
                        item._offsetY = (itemCenter > viewCenter ? 1 : -1) * (1 - ratio) * 20;
                  }
                  visibleItems.push(item);
            }

            // 计算上下占位高度
            const topPlaceholder = from * itemHeight * 750 / this._systemInfo.windowWidth;
            const bottomPlaceholder = (list.length - to) * itemHeight * 750 / this._systemInfo.windowWidth;

            this.setData({
                  visibleItems,
                  topPlaceholder,
                  bottomPlaceholder,
                  scrollTop: scrollTop
            });
      },

      // ==================== 数据加载 ====================

      listkind() {
            wx.getStorage({
                  key: 'iscard',
                  success: res => this.setData({ iscard: res.data }),
                  fail: () => this.setData({ iscard: true })
            });
      },

      changeCard() {
            const iscard = !this.data.iscard;
            this.setData({ iscard });
            wx.setStorage({ key: 'iscard', data: iscard });
            // 切换模式后重新计算窗口
            if (this.data.list.length > 0) {
                  this._updateVisibleItems(this._lastScrollTop);
            }
      },

      search() {
            wx.navigateTo({ url: '/pages/search/search' });
      },

      collegeSelect(e) {
            const index = e.currentTarget.dataset.id;
            const scrollLeft = index * 100 - 150;
            this.setData({
                  collegeCur: index,
                  scrollLeft: scrollLeft < 0 ? 0 : scrollLeft,
                  showList: false,
            });
            this._resetScroll();
            this.getList();
      },

      selectAll() {
            this.setData({
                  collegeCur: -2,
                  scrollLeft: 0,
                  showList: false,
            });
            this._resetScroll();
            this.getList();
      },

      showlist() {
            this.setData({ showList: !this.data.showList });
      },

      _resetScroll() {
            this._lastScrollTop = 0;
            wx.pageScrollTo({ scrollTop: 0, duration: 0 });
            this.setData({ topPlaceholder: 0, bottomPlaceholder: 0 });
      },

      getList() {
            if (!this.db) {
                  this.setData({ nomore: true, list: [], visibleItems: [] });
                  return;
            }

            const { collegeCur, college } = this.data;
            const _ = this._;

            let collegeid;
            if (collegeCur === -2) {
                  collegeid = _.neq(-2);
            } else {
                  collegeid = college[collegeCur].id + '';
            }

            this.setData({ nomore: false, loadingMore: true });

            this.db.collection('publish')
                  .where({
                        status: 0,
                        dura: _.gt(Date.now()),
                        collegeid: collegeid
                  })
                  .orderBy('creat', 'desc')
                  .limit(20)
                  .get()
                  .then(res => {
                        wx.stopPullDownRefresh();
                        const { data } = res;
                        this.setData({
                              nomore: data.length === 0 || data.length < 20,
                              loadingMore: false,
                              page: 0,
                              list: data,
                        });
                        // 初始窗口渲染
                        this._updateVisibleItems(0);
                  })
                  .catch(err => {
                        console.log('获取书籍列表失败:', err);
                        wx.stopPullDownRefresh();
                        this.setData({ nomore: true, loadingMore: false, list: [], visibleItems: [] });
                  });
      },

      more() {
            if (!this.db || this.data.nomore || this.data.loadingMore) return;
            if (this.data.list.length < 20) return;

            const page = this.data.page + 1;
            const { collegeCur, college } = this.data;
            const _ = this._;

            let collegeid;
            if (collegeCur === -2) {
                  collegeid = _.neq(-2);
            } else {
                  collegeid = college[collegeCur].id + '';
            }

            this.setData({ loadingMore: true });

            this.db.collection('publish')
                  .where({
                        status: 0,
                        dura: _.gt(Date.now()),
                        collegeid: collegeid
                  })
                  .orderBy('creat', 'desc')
                  .skip(page * 20)
                  .limit(20)
                  .get()
                  .then(res => {
                        const newData = res.data;
                        if (newData.length === 0) {
                              this.setData({ nomore: true, loadingMore: false });
                              return;
                        }
                        const nomore = newData.length < 20;
                        const newList = this.data.list.concat(newData);
                        this.setData({
                              nomore,
                              loadingMore: false,
                              page,
                              list: newList,
                        });
                        // 更新窗口
                        this._updateVisibleItems(this._lastScrollTop);
                  })
                  .catch(() => {
                        this.setData({ loadingMore: false });
                        wx.showToast({ title: '加载失败', icon: 'none' });
                  });
      },

      onReachBottom() {
            this.more();
      },

      onPullDownRefresh() {
            this._resetScroll();
            this.getList();
      },

      gotop() {
            wx.pageScrollTo({ scrollTop: 0 });
      },

      detail(e) {
            wx.navigateTo({
                  url: '/pages/detail/detail?scene=' + e.currentTarget.dataset.id,
            });
      },

      getbanner() {
            if (!this.db) return;
            this.db.collection('banner').get()
                  .then(res => {
                        if (res.data.length > 0) {
                              this.setData({ banner: res.data[0].list });
                        }
                  })
                  .catch(() => { /* 静默 */ });
      },

      onShareAppMessage() {
            return {
                  title: JSON.parse(config.data).share_title,
                  imageUrl: JSON.parse(config.data).share_img,
                  path: '/pages/start/start'
            };
      },
});
