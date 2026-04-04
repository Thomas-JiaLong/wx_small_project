/**
 * 图标管理工具
 * 从云数据库获取 base64 图标
 */

const ICON_CACHE = {}

/**
 * 获取图标 base64 数据
 * @param {string} name 图标名称 (不含扩展名)
 * @returns {Promise<string>} base64 数据 URL
 */
async function getIcon(name) {
  // 优先使用缓存
  if (ICON_CACHE[name]) {
    return ICON_CACHE[name]
  }

  try {
    const db = wx.cloud.database()
    const res = await db.collection('icons').where({
      name: name
    }).get()

    if (res.data.length > 0) {
      ICON_CACHE[name] = res.data[0].base64
      return res.data[0].base64
    }

    // 如果云端没有，返回本地路径
    return `/images/${name}.png`
  } catch (err) {
    console.error('获取图标失败:', name, err)
    return `/images/${name}.png`
  }
}

/**
 * 批量获取图标
 * @param {string[]} names 图标名称数组
 * @returns {Promise<Object>} { name: base64 }
 */
async function getIcons(names) {
  const result = {}
  
  // 分离已缓存和未缓存的
  const uncached = names.filter(name => !ICON_CACHE[name])
  
  if (uncached.length > 0) {
    try {
      const db = wx.cloud.database()
      const MAX_LIMIT = 20
      
      // 分批查询
      for (let i = 0; i < uncached.length; i += MAX_LIMIT) {
        const batch = uncached.slice(i, i + MAX_LIMIT)
        const res = await db.collection('icons').where({
          name: db.command.in(batch)
        }).get()

        res.data.forEach(item => {
          ICON_CACHE[item.name] = item.base64
        })
      }
    } catch (err) {
      console.error('批量获取图标失败:', err)
    }
  }

  // 组装结果
  names.forEach(name => {
    result[name] = ICON_CACHE[name] || `/images/${name}.png`
  })

  return result
}

/**
 * 预加载常用图标
 */
async function preloadCommonIcons() {
  const commonIcons = [
    'search', 'buy', 'scan', 'share', 'message', 'home', 'top',
    'right', 'list', 'card', 'local', 'contact', 'publish', 'user',
    'success', 'help', 'about', 'history', 'order', 'boy', 'girl'
  ]

  await getIcons(commonIcons)
  console.log('常用图标预加载完成')
}

/**
 * 清除缓存
 */
function clearCache() {
  Object.keys(ICON_CACHE).forEach(key => delete ICON_CACHE[key])
}

module.exports = {
  getIcon,
  getIcons,
  preloadCommonIcons,
  clearCache
}
