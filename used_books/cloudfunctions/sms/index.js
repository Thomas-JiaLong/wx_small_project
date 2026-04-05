/**
 * ============================================
 *  sms - 短信通知云函数
 * ============================================
 * 
 * 功能：发送订单通知短信
 * 
 * 【注意】短信功能需开通腾讯云短信服务并配置
 * 请在 keys.js 中填写 SMS 配置后再启用
 */

const cloud = require('wx-server-sdk');
const KEYS = require('../config/keys.js');

cloud.init({
  env: KEYS.WECHAT.cloudEnv || cloud.DYNAMIC_CURRENT_ENV
});

exports.main = async (event, context) => {
  const { mobile, title } = event;

  // 检查是否启用
  if (!KEYS.SMS.enabled) {
    return { success: false, message: '短信功能未启用' };
  }

  // 检查配置
  const { appid, appkey, templateId, sign } = KEYS.SMS.qcloud || {};
  if (!appid || !appkey || !templateId) {
    return {
      success: false,
      message: '短信配置不完整，请在 keys.js 中配置 SMS'
    };
  }

  // 手机号格式校验
  const mobileRegex = /^1[3-9]\d{9}$/;
  if (!mobile || !mobileRegex.test(mobile)) {
    return { success: false, message: '手机号格式不正确' };
  }

  try {
    const QcloudSms = require('qcloudsms_js');
    const qcloudsms = QcloudSms(appid, appkey);
    const ssender = qcloudsms.SmsSingleSender();

    const result = await new Promise((resolve, reject) => {
      ssender.sendWithParam(
        86,            // 中国大陆区号
        mobile,
        templateId,
        [title || '您的订单有新进展，请留意'], // 模板参数
        sign || '培正舟海',
        '', '',
        (err, res, resData) => {
          if (err) reject(err);
          else resolve(resData);
        }
      );
    });

    if (result.result === 0) {
      return { success: true, message: '发送成功' };
    } else {
      return { success: false, message: '发送失败: ' + result.errmsg };
    }
  } catch (e) {
    console.error('短信发送失败:', e);
    return { success: false, message: '发送失败: ' + e.message };
  }
};
