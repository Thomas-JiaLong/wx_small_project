/**
 * ============================================
 *  conversations - 聊天会话云函数（占位）
 * ============================================
 * 
 * 注意：会话管理已由 chat 云函数直接操作数据库实现。
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

  const { action = 'list' } = event;

  if (action === 'list') {
    try {
      const res = await db.collection('conversations')
        .where({
          participants: db.RegExp({ regexp: openid, options: 'i' })
        })
        .orderBy('lastMessageTime', 'desc')
        .limit(50)
        .get();

      return {
        success: true,
        data: res.data || [],
      };
    } catch (e) {
      console.error('获取会话列表失败:', e);
      return { success: false, message: '获取会话列表失败' };
    }
  }

  return { success: false, message: '未知操作' };
};
