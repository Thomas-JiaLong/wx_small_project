/**
 * ImageLoader - 云端图片资源加载器
 * 
 * 功能：
 * 1. 从云数据库读取图片配置
 * 2. 支持 base64 格式直接使用
 * 3. 内存缓存，避免重复请求
 * 
 * 使用方式：
 *   const img = require('./imageLoader.js');
 *   
 *   // 静态方式 - 直接返回本地路径（初始版本，逐步迁移到云端）
 *   img.get('logo')  // -> '/images/logo.png'
 *   
 *   // 云端方式 - 从云数据库获取 base64
 *   img.getAsync('logo').then(base64Url => { ... })
 *   
 *   // 在 wxml 中使用
 *   // 需要先在 js 中获取图片 URL，再绑定到 data
 */

const app = getApp();

// 图片资源映射表
// key: 图片标识
// value: { local: 本地路径, cloud: 云端URL或base64, type: 类型 }
const IMAGE_MAP = {
  // ==================== 大图（将迁移到云端）====================
  logo:      { local: '/images/logo.png',      cloud: null, maxKB: 50  },
  startBg:   { local: '/images/startBg.jpg',  cloud: null, maxKB: 30  },
  kefu:      { local: '/images/kefu.jpg',      cloud: null, maxKB: 20  },
  isbn:      { local: '/images/isbn.jpg',     cloud: null, maxKB: 20  },
  poster:    { local: '/images/poster.jpg',   cloud: null, maxKB: 20  },
  // ==================== 中图（建议云端化）====================
  code:      { local: '/images/code.png',      cloud: null, maxKB: 15  },
  success:   { local: '/images/success.png',  cloud: null, maxKB: 10  },
  avator:    { local: '/images/avator.png',   cloud: null, maxKB: 10  },
  blank:     { local: '/images/blank.png',   cloud: null, maxKB: 5   },
  suc:       { local: '/images/suc.png',      cloud: null, maxKB: 5   },
  // ==================== 小图标（保持本地，速度更快）====================
  scan:      { local: '/images/scan.png',      cloud: null, isIcon: true },
  search:    { local: '/images/search.png',   cloud: null, isIcon: true },
  card:      { local: '/images/card.png',     cloud: null, isIcon: true },
  list:      { local: '/images/list.png',     cloud: null, isIcon: true },
  local:     { local: '/images/local.png',   cloud: null, isIcon: true },
  buy:       { local: '/images/buy.png',      cloud: null, isIcon: true },
  contact:   { local: '/images/contact.png',  cloud: null, isIcon: true },
  help:      { local: '/images/help.png',     cloud: null, isIcon: true },
  about:     { local: '/images/about.png',    cloud: null, isIcon: true },
  order:     { local: '/images/order.png',    cloud: null, isIcon: true },
  home:      { local: '/images/home.png',     cloud: null, isIcon: true },
  share:     { local: '/images/share.png',    cloud: null, isIcon: true },
  top:       { local: '/images/top.png',      cloud: null, isIcon: true },
  message:   { local: '/images/message.png',  cloud: null, isIcon: true },
  right:     { local: '/images/right.png',    cloud: null, isIcon: true },
  his:       { local: '/images/his.png',      cloud: null, isIcon: true },
  history:   { local: '/images/history.png',  cloud: null, isIcon: true },
  publish:   { local: '/images/publish.png',  cloud: null, isIcon: true },
  user:      { local: '/images/user.png',     cloud: null, isIcon: true },
  // tabBar 图标
  tabHome:   { local: '/images/tabbar/home.png',       cloud: null, isIcon: true },
  tabHomeOn: { local: '/images/tabbar/home_on.png',    cloud: null, isIcon: true },
  tabMy:     { local: '/images/tabbar/my.png',         cloud: null, isIcon: true },
  tabMyOn:   { local: '/images/tabbar/my_on.png',      cloud: null, isIcon: true },
  tabPub:    { local: '/images/tabbar/publish.png',    cloud: null, isIcon: true },
  tabPubOn:  { local: '/images/tabbar/publish_on.png', cloud: null, isIcon: true },
};

// 本地缓存
let localCache = {};
// 云端资源缓存（内存）
let cloudCache = {};
// 是否已初始化云端资源
let initialized = false;

/**
 * 获取图片路径（静态方式 - 返回本地路径）
 * 这是兼容性最好的方式，小程序会从本地加载
 * 
 * @param {string} key 图片标识
 * @returns {string} 图片路径
 */
function get(key) {
  const img = IMAGE_MAP[key];
  if (!img) {
    console.warn(`[ImageLoader] 未知的图片key: ${key}`);
    return '';
  }
  return img.cloud || img.local;
}

/**
 * 异步获取图片URL（云端方式）
 * 首次会从云数据库获取，后续使用缓存
 * 
 * @param {string} key 图片标识
 * @returns {Promise<string>} base64 URL 或本地路径
 */
async function getAsync(key) {
  // 小图标始终返回本地路径（更快）
  const img = IMAGE_MAP[key];
  if (!img) {
    console.warn(`[ImageLoader] 未知的图片key: ${key}`);
    return '';
  }

  // 已有云端缓存
  if (cloudCache[key]) {
    return cloudCache[key];
  }

  // 初始化云端资源
  if (!initialized) {
    await init();
  }

  // 返回云端或本地
  const url = cloudCache[key] || img.local;
  return url;
}

/**
 * 批量获取图片（云端方式）
 * 
 * @param {string[]} keys 图片标识数组
 * @returns {Promise<Object>} key -> url 映射
 */
async function getBatch(keys) {
  const results = {};
  const missing = [];

  for (const key of keys) {
    if (cloudCache[key]) {
      results[key] = cloudCache[key];
    } else {
      missing.push(key);
    }
  }

  // 批量获取缺失的资源
  if (missing.length > 0 && initialized) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'assets',
        data: { keys: missing }
      });
      if (res.result && res.result.success) {
        Object.entries(res.result.data).forEach(([k, v]) => {
          if (v.base64) {
            const dataUrl = `data:${v.mime};base64,${v.base64}`;
            cloudCache[k] = dataUrl;
            results[k] = dataUrl;
          }
        });
      }
    } catch (e) {
      console.warn('[ImageLoader] 批量获取失败', e);
    }
  }

  // 补齐本地路径
  for (const key of missing) {
    if (!results[key]) {
      results[key] = IMAGE_MAP[key]?.local || '';
    }
  }

  return results;
}

/**
 * 初始化 - 从云数据库加载图片资源配置
 */
async function init() {
  if (initialized) return;
  
  try {
    const res = await wx.cloud.callFunction({
      name: 'assets',
      data: {}
    });
    
    if (res.result && res.result.success) {
      (res.result.data || []).forEach(item => {
        if (item.key && item.base64) {
          cloudCache[item.key] = `data:${item.mime || 'image/png'};base64,${item.base64}`;
        }
      });
      console.log(`[ImageLoader] 已加载 ${Object.keys(cloudCache).length} 个云端图片资源`);
    }
  } catch (e) {
    console.warn('[ImageLoader] 云端资源加载失败，使用本地资源:', e.message);
  }
  
  initialized = true;
}

/**
 * 预加载指定图片到缓存
 * 建议在 app.js onLaunch 中调用
 */
async function preload(keys = null) {
  if (!keys) {
    // 预加载所有非图标资源
    keys = Object.entries(IMAGE_MAP)
      .filter(([, v]) => !v.isIcon)
      .map(([k]) => k);
  }
  await getBatch(keys);
}

/**
 * 清除缓存
 */
function clearCache() {
  cloudCache = {};
  initialized = false;
}

/**
 * 获取当前加载状态
 */
function getStatus() {
  return {
    initialized,
    cloudCount: Object.keys(cloudCache).length,
    localCount: Object.keys(IMAGE_MAP).length,
  };
}

module.exports = {
  get,           // 静态获取（返回本地路径）
  getAsync,      // 异步获取（优先云端）
  getBatch,      // 批量获取
  init,          // 初始化
  preload,       // 预加载
  clearCache,    // 清除缓存
  getStatus,     // 状态查询
  IMAGE_MAP,     // 图片映射表（可外部访问）
};
