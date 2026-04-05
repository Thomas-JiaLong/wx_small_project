/**
 * ============================================
 *  ref - 提现云函数
 * ============================================
 * 
 * 【重要】微信企业付款到零钱功能需满足以下条件：
 * 1. 已认证的微信商户号
 * 2. 已开通企业付款到零钱
 * 3. 证书 cert 文件已上传至云存储
 * 
 * 当前版本默认未开通，请先在 keys.js 配置后开启
 */

const cloud = require('wx-server-sdk');
const KEYS = require('../config/keys.js');

cloud.init({
  env: KEYS.WECHAT.cloudEnv || cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 检查微信支付是否已配置
const isPayConfigured = () => {
  const { appid, mchid, partnerKey } = KEYS.WXPAY;
  return !!(appid && mchid && partnerKey);
};

exports.main = async (event, context) => {
  const { userid, num } = event;
  const amount = parseInt(num) || 0;

  // 1. 参数校验
  if (!userid || !num) {
    return { success: false, message: '参数错误' };
  }

  if (amount < 10) {
    return { success: false, message: '单笔提现金额不得低于10元' };
  }

  if (amount > 30) {
    return { success: false, message: '单笔提现金额不得超过30元' };
  }

  // 2. 获取用户
  let userInfo;
  try {
    const res = await db.collection('user').doc(userid).get();
    userInfo = res.data;
  } catch (e) {
    return { success: false, message: '用户不存在' };
  }

  if (!userInfo) {
    return { success: false, message: '用户不存在' };
  }

  // 3. 检查余额
  const currentBalance = parseInt(userInfo.parse) || 0;
  if (currentBalance < amount) {
    return { success: false, message: '余额不足' };
  }

  // 4. 微信支付未配置时，直接拒绝提现
  if (!isPayConfigured()) {
    return {
      success: false,
      message: '提现功能暂未开放，请联系管理员配置微信商户号'
    };
  }

  // 5. 以下为微信企业付款代码（需开通支付后启用）
  // ============================================
  // const tenpay = require('tenpay');
  // const config = {
  //   appid: KEYS.WXPAY.appid,
  //   mchid: KEYS.WXPAY.mchid,
  //   partnerKey: KEYS.WXPAY.partnerKey,
  //   pfx: ...,
  //   notifyUrl: KEYS.WXPAY.notifyUrl,
  // };
  // const pay = new tenpay(config, true);
  // const result = await pay.transfers({
  //   partner_trade_no: 'bookreflect' + Date.now() + num,
  //   openid: userInfo._openid,
  //   check_name: 'NO_CHECK',
  //   amount: amount * (100 - KEYS.WXPAY.rate) / 100,
  //   desc: '培正舟海二手书提现',
  // });
  // if (result.result_code === 'SUCCESS') {
  //   await db.collection('user').doc(userid).update({
  //     data: { parse: currentBalance - amount }
  //   });
  //   return { success: true, message: '提现成功' };
  // }
  // return { success: false, message: '提现失败: ' + result.err_code_des };
  // ============================================

  return {
    success: false,
    message: '提现功能暂未开放，请联系管理员'
  };
};
