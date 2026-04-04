const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

/**
 * 获取或创建会话
 * params: { sellerId, bookId, bookTitle }
 */
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { sellerId, bookId, bookTitle } = event;

  try {
    // 检查是否已存在会话
    const exist = await db.collection('conversations')
      .where({
        participants: db.command.all([OPENID, sellerId]),
        bookId: bookId,
      })
      .get();

    if (exist.data.length > 0) {
      return { success: true, data: exist.data[0] };
    }

    // 获取卖家信息
    const seller = await db.collection('user')
      .where({ _openid: sellerId })
      .get();

    const sellerInfo = seller.data[0] || {};

    // 创建新会话
    const result = await db.collection('conversations').add({
      data: {
        participants: [OPENID, sellerId],
        participantNames: {
          [OPENID]: '我',
          [sellerId]: sellerInfo.nickName || '用户',
        },
        participantAvatars: {
          [OPENID]: '',
          [sellerId]: sellerInfo.avatarUrl || '',
        },
        bookId: bookId,
        bookTitle: bookTitle || '',
        lastMsg: '',
        lastTime: Date.now(),
        unread: 0,
        createTime: Date.now(),
      },
    });

    return { success: true, data: { _id: result._id, ...sellerInfo } };

  } catch (err) {
    console.error('创建会话失败', err);
    return { success: false, error: err.message };
  }
};
