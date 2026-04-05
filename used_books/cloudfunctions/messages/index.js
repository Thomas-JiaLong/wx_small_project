/**
 * ============================================
 *  messages - 聊天消息云函数（占位）
 * ============================================
 * 
 * 注意：聊天消息的读写已由 chat 云函数直接操作数据库实现。
 * 此函数作为扩展接口预留，当前可直接调用 chat 云函数。
 */

const cloud = require('wx-server-sdk');
const KEYS = require('../config/keys.js');

cloud.init({
  env: KEYS.WECHAT.cloudEnv || cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  const { action = 'list', conversationId, pageSize = 20, skip = 0 } = event;

  if (action === 'list' && conversationId) {
    try {
      const res = await db.collection('messages')
        .where({ conversationId })
        .orderBy('createTime', 'desc')
        .skip(skip)
        .limit(pageSize)
        .get();

      return {
        success: true,
        data: res.data || [],
      };
    } catch (e) {
      console.error('获取消息失败:', e);
      return { success: false, message: '获取消息失败' };
    }
  }

  return { success: false, message: '未知操作' };
};
