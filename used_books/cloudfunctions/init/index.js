const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const collections = [
    'publish',        // 发布信息
    'books',          // 书籍信息
    'user',           // 用户信息
    'order',          // 订单
    'history',        // 交易记录
    'banner',         // 轮播图
    'conversations',  // 会话（聊天）
    'messages',       // 消息（聊天）
  ];

  const results = [];
  const errors = [];

  for (const name of collections) {
    try {
      await db.createCollection(name);
      results.push(`✅ ${name} 创建成功`);
    } catch (err) {
      if (err.message && err.message.includes('already exist')) {
        results.push(`⚠️ ${name} 已存在，跳过`);
      } else {
        errors.push(`❌ ${name} 创建失败: ${err.message}`);
      }
    }
  }

  return {
    success: errors.length === 0,
    message: '集合初始化完成',
    results: [...results, ...errors],
  };
};
