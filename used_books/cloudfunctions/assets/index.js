// 云函数: assets
// 用于读取云数据库中的图片资源配置，支持 base64 编码格式

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

/**
 * 获取图片资源配置
 * 支持单个 key 或批量获取
 */
exports.main = async (event, context) => {
  const { key, keys } = event;

  try {
    // 批量获取
    if (keys && Array.isArray(keys)) {
      const { data } = await db.collection('imageAssets').where({
        key: db.command.in(keys)
      }).get();
      const result = {};
      data.forEach(item => {
        result[item.key] = item;
      });
      return { success: true, data: result };
    }

    // 单个获取
    if (key) {
      const { data } = await db.collection('imageAssets').where({ key }).get();
      if (data.length > 0) {
        return { success: true, data: data[0] };
      }
      return { success: false, message: '资源不存在' };
    }

    // 获取全部（仅开发调试用）
    const { data } = await db.collection('imageAssets').limit(100).get();
    return { success: true, data };

  } catch (err) {
    return { success: false, message: err.message };
  }
};
