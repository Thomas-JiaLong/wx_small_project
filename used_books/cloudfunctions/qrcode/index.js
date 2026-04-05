/**
 * ============================================
 *  qrcode - 小程序码生成云函数
 * ============================================
 * 
 * 功能：生成小程序二维码/小程序码
 * 优先从云存储读取，已存在则直接返回
 * 不存在则调用微信 API 生成并上传云存储
 */

const cloud = require('wx-server-sdk');
const KEYS = require('../config/keys.js');

cloud.init({
  env: KEYS.WECHAT.cloudEnv || cloud.DYNAMIC_CURRENT_ENV
});

exports.main = async (event, context) => {
  const { scene = '', page = 'pages/detail/detail' } = event;

  // 场景值长度限制（微信限制最大32字符）
  if (scene.length > 32) {
    return { success: false, message: 'scene参数过长，最大32字符' };
  }

  const cloudPath = `share/${scene}.jpeg`;

  // 1. 优先从云存储读取（命中缓存）
  try {
    await cloud.downloadFile({ fileID: cloudPath });
    return { success: true, cached: true, fileID: cloudPath };
  } catch (e) {
    // 不存在则继续生成
  }

  // 2. 调用微信接口生成小程序码
  try {
    const bufferContent = await cloud.openapi.wxacode.getUnlimited({
      scene: scene,
      page: page, // 注意：必须是已发布的小程序中存在的页面
      envVersion: 'release', // 'release'正式版 / 'trial'体验版 / 'develop'开发版
      width: 280,
    });

    // 3. 上传到云存储
    const uploadResult = await cloud.uploadFile({
      cloudPath: cloudPath,
      fileContent: bufferContent.buffer,
    });

    return {
      success: true,
      cached: false,
      fileID: uploadResult.fileID,
    };
  } catch (e) {
    console.error('生成小程序码失败:', e);
    return {
      success: false,
      message: e.message || '生成失败',
    };
  }
};
