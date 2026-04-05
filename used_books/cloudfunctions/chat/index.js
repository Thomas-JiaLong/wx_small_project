/**
 * ============================================
 *  chat - 即时通讯云函数
 * ============================================
 * 
 * 功能：
 * 1. getOrCreate  - 获取或创建会话
 * 2. getMessages  - 获取消息列表
 * 3. sendMessage  - 发送消息
 * 4. markRead     - 标记已读
 * 5. deleteConversation - 删除会话
 */

const cloud = require('wx-server-sdk');
const TcbRouter = require('tcb-router');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

/**
 * 获取或创建会话
 */
async function getOrCreateConversation(openid, sellerId, bookId, bookTitle) {
  // 检查是否已存在会话
  const exist = await db.collection('conversations')
    .where({
      participants: _.all([openid, sellerId]),
      bookId: bookId,
    })
    .get();

  if (exist.data.length > 0) {
    return exist.data[0];
  }

  // 获取卖家信息
  let sellerInfo = { info: { nickName: '用户', avatarUrl: '' } };
  try {
    const seller = await db.collection('user')
      .where({ _openid: sellerId })
      .get();
    if (seller.data && seller.data.length > 0) {
      sellerInfo = seller.data[0];
    }
  } catch (e) {}

  // 获取买家信息
  let buyerInfo = { info: { nickName: '我', avatarUrl: '' } };
  try {
    const buyer = await db.collection('user')
      .where({ _openid: openid })
      .get();
    if (buyer.data && buyer.data.length > 0) {
      buyerInfo = buyer.data[0];
    }
  } catch (e) {}

  // 创建新会话
  const conversationData = {
    participants: [openid, sellerId],
    participantNames: {
      [openid]: buyerInfo.info?.nickName || '我',
      [sellerId]: sellerInfo.info?.nickName || '用户',
    },
    participantAvatars: {
      [openid]: buyerInfo.info?.avatarUrl || '',
      [sellerId]: sellerInfo.info?.avatarUrl || '',
    },
    bookId: bookId || '',
    bookTitle: bookTitle || '',
    lastMsg: '',
    lastTime: Date.now(),
    unreadMap: {
      [openid]: 0,
      [sellerId]: 0,
    },
    createTime: Date.now(),
  };
  
  const result = await db.collection('conversations').add({
    data: conversationData,
  });

  return { _id: result.id, ...conversationData };
}

exports.main = async (event, context) => {
  const app = new TcbRouter({ event });
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  // ============================================
  // 1. 获取或创建会话
  // ============================================
  app.router('getOrCreate', async (ctx) => {
    const { sellerId, bookId, bookTitle } = event;

    if (!sellerId) {
      ctx.body = { success: false, message: '缺少卖家ID' };
      return;
    }

    try {
      const conversation = await getOrCreateConversation(openid, sellerId, bookId, bookTitle);
      
      // 获取对方信息
      const otherOpenid = sellerId;
      const otherName = conversation.participantNames?.[otherOpenid] || '用户';
      const otherAvatar = conversation.participantAvatars?.[otherOpenid] || '';

      ctx.body = {
        success: true,
        data: {
          _id: conversation._id,
          otherOpenid,
          otherName,
          otherAvatar,
          bookTitle: conversation.bookTitle,
        }
      };
    } catch (err) {
      console.error('获取/创建会话失败', err);
      ctx.body = { success: false, message: err.message };
    }
  });

  // ============================================
  // 2. 获取消息列表
  // ============================================
  app.router('getMessages', async (ctx) => {
    const { conversationId, page = 0, pageSize = 20 } = event;

    if (!conversationId) {
      ctx.body = { success: false, message: '缺少会话ID' };
      return;
    }

    try {
      const messages = await db.collection('messages')
        .where({ conversationId })
        .orderBy('createTime', 'asc')
        .skip(page * pageSize)
        .limit(pageSize)
        .get();

      ctx.body = {
        success: true,
        data: messages.data,
        hasMore: messages.data.length === pageSize,
      };
    } catch (err) {
      console.error('获取消息失败', err);
      ctx.body = { success: false, message: err.message };
    }
  });

  // ============================================
  // 3. 发送消息
  // ============================================
  app.router('send', async (ctx) => {
    const { conversationId, content, type = 'text' } = event;

    if (!conversationId || !content) {
      ctx.body = { success: false, message: '参数错误' };
      return;
    }

    try {
      // 获取发送者信息
      let senderInfo = { info: { nickName: '我', avatarUrl: '' } };
      try {
        const user = await db.collection('user')
          .where({ _openid: openid })
          .get();
        if (user.data && user.data.length > 0) {
          senderInfo = user.data[0];
        }
      } catch (e) {}

      // 创建消息
      const messageData = {
        conversationId,
        senderId: openid,
        senderName: senderInfo.info?.nickName || '我',
        senderAvatar: senderInfo.info?.avatarUrl || '',
        type,
        content,
        createTime: Date.now(),
        read: false,
      };

      const msgResult = await db.collection('messages').add({
        data: messageData,
      });

      // 更新会话最后消息
      await db.collection('conversations').doc(conversationId).update({
        data: {
          lastMsg: type === 'text' ? content : '[图片]',
          lastTime: Date.now(),
        }
      });

      ctx.body = {
        success: true,
        data: {
          _id: msgResult.id,
          ...messageData,
        }
      };
    } catch (err) {
      console.error('发送消息失败', err);
      ctx.body = { success: false, message: err.message };
    }
  });

  // ============================================
  // 4. 标记已读
  // ============================================
  app.router('markRead', async (ctx) => {
    const { conversationId } = event;

    if (!conversationId) {
      ctx.body = { success: false, message: '缺少会话ID' };
      return;
    }

    try {
      // 标记所有非自己的消息为已读
      await db.collection('messages')
        .where({
          conversationId,
          senderId: _.neq(openid),
          read: false,
        })
        .update({
          data: { read: true },
        });

      // 重置未读数
      await db.collection('conversations').doc(conversationId).update({
        data: {
          [`unreadMap.${openid}`]: 0,
        }
      });

      ctx.body = { success: true };
    } catch (err) {
      console.error('标记已读失败', err);
      ctx.body = { success: false, message: err.message };
    }
  });

  // ============================================
  // 5. 删除会话
  // ============================================
  app.router('delete', async (ctx) => {
    const { conversationId } = event;

    if (!conversationId) {
      ctx.body = { success: false, message: '缺少会话ID' };
      return;
    }

    try {
      // 删除会话
      await db.collection('conversations').doc(conversationId).remove();

      // 删除所有消息
      await db.collection('messages')
        .where({ conversationId })
        .remove();

      ctx.body = { success: true };
    } catch (err) {
      console.error('删除会话失败', err);
      ctx.body = { success: false, message: err.message };
    }
  });

  return app.serve();
};
