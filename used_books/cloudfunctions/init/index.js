const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const collections = [
    { name: 'publish', desc: '书籍发布信息' },
    { name: 'books', desc: '书籍详情库' },
    { name: 'user', desc: '用户信息' },
    { name: 'order', desc: '交易订单' },
    { name: 'history', desc: '交易记录' },
    { name: 'banner', desc: '首页轮播图' },
    { name: 'conversations', desc: '聊天会话' },
    { name: 'messages', desc: '聊天消息' },
  ];

  const results = [];
  const errors = [];

  for (const item of collections) {
    try {
      await db.createCollection(item.name);
      results.push({
        name: item.name,
        desc: item.desc,
        status: 'success',
        message: '创建成功 ✓'
      });
    } catch (err) {
      // 集合已存在
      if (err.errCode === -501001 || (err.message && err.message.includes('exist'))) {
        results.push({
          name: item.name,
          desc: item.desc,
          status: 'exists',
          message: '已存在，跳过'
        });
      } else {
        // 权限不足或其他错误
        errors.push({
          name: item.name,
          desc: item.desc,
          status: 'error',
          message: err.errMsg || err.message || '未知错误',
          errCode: err.errCode
        });
      }
    }
  }

  // 生成友好提示
  let friendlyTip = '';
  if (errors.length > 0) {
    friendlyTip = `💡 提示：部分集合创建失败，请在「云开发控制台 → 数据库」中手动创建这些集合：\n${errors.map(e => `   • ${e.name}（${e.desc}）`).join('\n')}`;
  } else if (results.filter(r => r.status === 'success').length > 0) {
    friendlyTip = '🎉 所有集合创建成功！可以开始使用小程序了';
  } else {
    friendlyTip = '✅ 所有集合已就绪，可以正常使用';
  }

  return {
    success: errors.length === 0,
    message: friendlyTip,
    summary: {
      total: collections.length,
      created: results.filter(r => r.status === 'success').length,
      exists: results.filter(r => r.status === 'exists').length,
      failed: errors.length
    },
    details: [...results, ...errors],
    helpUrl: 'https://developers.weixin.qq.com/miniprogram/dev/wxcloud/guide/database.html'
  };
};
