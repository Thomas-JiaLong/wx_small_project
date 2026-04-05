/**
 * ============================================
 *  pay - 支付与钱包操作云函数
 * ============================================
 * 
 * 功能列表：
 * 1. recharge  - 钱包充值（直接充值，无微信支付）
 * 2. changeP   - 修改发布状态
 * 3. changeO   - 修改订单状态
 * 
 * 【注意】微信支付充值需开通商户号并配置 cert 证书
 * 当前默认使用直接充值模式（管理员后台操作）
 */

const cloud = require('wx-server-sdk');
const TcbRouter = require('tcb-router');
const KEYS = require('../config/keys.js');

// 云开发环境（使用配置中心）
cloud.init({
  env: KEYS.WECHAT.cloudEnv || cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  const app = new TcbRouter({ event });

  // ============================================
  // 1. 钱包充值（直接充值模式）
  //    说明：当前无微信支付资质，使用直接充值
  //    实际项目中建议开通微信支付后改为真实支付
  // ============================================
  app.router('recharge', async (ctx) => {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const amount = parseFloat(event.num) || 0;

    if (amount <= 0) {
      ctx.body = { success: false, message: '充值金额必须大于0' };
      return;
    }

    if (amount > 10000) {
      ctx.body = { success: false, message: '单次充值金额不得超过10000元' };
      return;
    }

    try {
      // 获取用户
      const userRes = await db.collection('user').where({ _openid: openid }).get();
      if (!userRes.data || userRes.data.length === 0) {
        ctx.body = { success: false, message: '用户不存在，请先登录' };
        return;
      }

      const user = userRes.data[0];
      const currentBalance = parseFloat(user.parse || 0);
      const newBalance = currentBalance + amount;

      // 更新余额
      await db.collection('user').doc(user._id).update({
        data: {
          parse: newBalance,
          updatedat: new Date().getTime()
        }
      });

      // 记录交易
      await db.collection('history').add({
        data: {
          stamp: new Date().getTime(),
          type: 1, // 1=充值
          name: '钱包充值',
          num: amount,
          oid: openid,
          balance: newBalance,
        }
      });

      ctx.body = {
        success: true,
        message: '充值成功',
        data: {
          balance: newBalance,
          amount: amount
        }
      };
    } catch (e) {
      console.error('充值失败:', e);
      ctx.body = { success: false, message: '充值失败: ' + e.message };
    }
  });

  // ============================================
  // 2. 修改发布状态
  // ============================================
  app.router('changeP', async (ctx) => {
    const { _id, status } = event;

    if (!_id) {
      ctx.body = { success: false, message: '参数错误' };
      return;
    }

    try {
      await db.collection('publish').doc(_id).update({
        data: { status: status }
      });
      ctx.body = { success: true, message: '状态更新成功' };
    } catch (e) {
      console.error('更新发布状态失败:', e);
      ctx.body = { success: false, message: '更新失败' };
    }
  });

  // ============================================
  // 3. 修改订单状态
  // ============================================
  app.router('changeO', async (ctx) => {
    const { _id, status } = event;

    if (!_id) {
      ctx.body = { success: false, message: '参数错误' };
      return;
    }

    try {
      await db.collection('order').doc(_id).update({
        data: { status: status }
      });
      ctx.body = { success: true, message: '状态更新成功' };
    } catch (e) {
      console.error('更新订单状态失败:', e);
      ctx.body = { success: false, message: '更新失败' };
    }
  });

  return app.serve();
};
