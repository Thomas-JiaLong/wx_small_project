/**
 * ============================================
 *  regist - 用户注册云函数
 * ============================================
 * 
 * 功能列表：
 * 1. phone  - 获取手机号（需企业微信或用户主动授权）
 * 2. getid  - 获取用户 openid
 */

const cloud = require('wx-server-sdk');
const TcbRouter = require('tcb-router');
const KEYS = require('../config/keys.js');

const wxurl = 'https://api.weixin.qq.com';

// 云开发环境
cloud.init({
  env: KEYS.WECHAT.cloudEnv || cloud.DYNAMIC_CURRENT_ENV
});

exports.main = async (event, context) => {
  const app = new TcbRouter({ event });

  // ============================================
  // 1. 获取 openid
  // ============================================
  app.router('getid', async (ctx) => {
    const wxContext = cloud.getWXContext();
    ctx.body = {
      success: true,
      openid: wxContext.OPENID,
    };
  });

  // ============================================
  // 2. 手机号解密（需用户主动点击按钮授权）
  // ============================================
  app.router('phone', async (ctx) => {
    const { code, encryptedData, iv } = event;

    if (!code) {
      ctx.body = { success: false, message: 'code不能为空' };
      return;
    }

    // 使用 keys.js 中配置的 appId / appSecret
    const appid = KEYS.WECHAT.appId;
    const appSecret = KEYS.WECHAT.appSecret;

    if (!appid || !appSecret) {
      ctx.body = {
        success: false,
        message: '未配置小程序 AppId/AppSecret，请联系管理员'
      };
      return;
    }

    try {
      // 通过 code 换取 session_key
      const sessionRes = await cloud.cloudCallContainer({
        config: { env: KEYS.WECHAT.cloudEnv },
        path: '/login',
        method: 'GET',
        query: {
          appid,
          secret: appSecret,
          js_code: code,
          grant_type: 'authorization_code',
        },
      });

      const body = typeof sessionRes === 'string' ? JSON.parse(sessionRes) : sessionRes;
      if (!body.session_key) {
        ctx.body = { success: false, message: '获取session_key失败' };
        return;
      }

      // 解密手机号
      const crypto = require('crypto');
      const sessionKey = Buffer.from(body.session_key, 'base64');
      const encryptedBuffer = Buffer.from(encryptedData, 'base64');
      const ivBuffer = Buffer.from(iv, 'base64');

      let decipher;
      try {
        decipher = crypto.createDecipheriv('aes-128-cbc', sessionKey, ivBuffer);
        decipher.setAutoPadding(true);
        let decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
        const data = JSON.parse(decrypted.toString('utf8', 4)); // 前4字节是内容长度
        ctx.body = { success: true, data };
      } catch (decryptErr) {
        // 若encryptedData为空或不合法，直接返回session_key
        ctx.body = {
          success: false,
          message: '手机号解密失败（可能未授权），请用户点击按钮授权',
          session_key: body.session_key,
        };
      }
    } catch (e) {
      console.error('手机号获取失败:', e);
      ctx.body = { success: false, message: '服务器错误: ' + e.message };
    }
  });

  return app.serve();
};
