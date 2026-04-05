/**
 * ============================================
 *  email - 邮件通知云函数
 * ============================================
 * 
 * 功能：发送订单状态邮件通知
 * 
 * 参数说明：
 *   type      - 通知类型（见下表）
 *   email     - 收件人邮箱（直接指定，优先使用）
 *   sellerOpenid - 卖家openid（无email时，从数据库查询）
 *   title     - 书籍名称
 * 
 * 通知类型：
 *   type=1    发货提醒 → 发给卖家，有新订单了
 *   type=2    收货提醒 → 发给买家，提醒确认收货
 *   type=3    交易取消 → 发给买家，卖家取消了
 *   type=4    订单取消 → 发给卖家，买家取消了
 *   type=5    交易完成 → 发给卖家，买家已收货
 */

const cloud = require('wx-server-sdk');
const nodemailer = require('nodemailer');
const KEYS = require('../config/keys.js');

cloud.init({
  env: KEYS.WECHAT.cloudEnv || cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 通知模板
const TEMPLATES = {
  1: {
    subject: '📦 您有新的订单！',
    body: (title, xcxname) =>
      `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">` +
      `<h2 style="color:#00d4ff;">您有新的订单！</h2>` +
      `<p>亲爱的同学，您好！</p>` +
      `<p>您在【<strong style="color:#00d4ff;">${xcxname}</strong>】小程序内发布的书籍` +
      `<strong>《${title}》</strong> 刚刚被人买下了！</p>` +
      `<p>💡 <strong>请尽快发货</strong>，发货后款项将打入您的钱包。</p>` +
      `<hr style="border:none;border-top:1px solid #eee;margin:20px 0;">` +
      `<p style="color:#888;font-size:12px;">来自 ${xcxname} 二手书交易平台</p>` +
      `</div>`
  },
  2: {
    subject: '📩 请确认收货！',
    body: (title, xcxname) =>
      `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">` +
      `<h2 style="color:#00d4ff;">收货提醒</h2>` +
      `<p>亲爱的同学，您好！</p>` +
      `<p>您在【<strong style="color:#00d4ff;">${xcxname}</strong>】小程序内购买的书籍` +
      `<strong>《${title}》</strong> 还没有确认收货哟~</p>` +
      `<p>💡 如果您已经收到书籍，请<strong>尽快确认收货</strong>，别让卖家同学等急了！</p>` +
      `<hr style="border:none;border-top:1px solid #eee;margin:20px 0;">` +
      `<p style="color:#888;font-size:12px;">来自 ${xcxname} 二手书交易平台</p>` +
      `</div>`
  },
  3: {
    subject: '📋 交易已取消通知',
    body: (title, xcxname) =>
      `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">` +
      `<h2 style="color:#ff6b6b;">交易已取消</h2>` +
      `<p>亲爱的同学，您好！</p>` +
      `<p>您在【<strong style="color:#00d4ff;">${xcxname}</strong>】小程序内购买的书籍` +
      `<strong>《${title}》</strong> 已被卖家取消交易。</p>` +
      `<p>✅ 款项已<strong>自动退还</strong>到您的小程序钱包，请留意查收~</p>` +
      `<hr style="border:none;border-top:1px solid #eee;margin:20px 0;">` +
      `<p style="color:#888;font-size:12px;">来自 ${xcxname} 二手书交易平台</p>` +
      `</div>`
  },
  4: {
    subject: '📋 订单已取消通知',
    body: (title, xcxname) =>
      `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">` +
      `<h2 style="color:#ff6b6b;">订单已取消</h2>` +
      `<p>亲爱的同学，您好！</p>` +
      `<p>您在【<strong style="color:#00d4ff;">${xcxname}</strong>】小程序内发布的书籍` +
      `<strong>《${title}》</strong> 已被买家取消订单。</p>` +
      `<p>📚 书籍已自动恢复到发布状态，可等待下一位买家。</p>` +
      `<hr style="border:none;border-top:1px solid #eee;margin:20px 0;">` +
      `<p style="color:#888;font-size:12px;">来自 ${xcxname} 二手书交易平台</p>` +
      `</div>`
  },
  5: {
    subject: '✅ 交易完成！款项已到账',
    body: (title, xcxname) =>
      `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">` +
      `<h2 style="color:#51cf66;">交易完成！</h2>` +
      `<p>亲爱的同学，您好！</p>` +
      `<p>您在【<strong style="color:#00d4ff;">${xcxname}</strong>】小程序内发布的书籍` +
      `<strong>《${title}》</strong> 已完成交易！</p>` +
      `<p>💰 款项已打入您的小程序钱包，可以去「我的」→「钱包」查看~</p>` +
      `<hr style="border:none;border-top:1px solid #eee;margin:20px 0;">` +
      `<p style="color:#888;font-size:12px;">来自 ${xcxname} 二手书交易平台</p>` +
      `</div>`
  },
};

exports.main = async (event, context) => {
  const { type = 1, email: directEmail, sellerOpenid, title = '书籍' } = event;
  const xcxname = KEYS.EMAIL.sender.name || '培正舟海二手书';

  // 如果没有直接提供邮箱，尝试通过openid查询
  let toEmail = directEmail;

  if (!toEmail && sellerOpenid) {
    try {
      const userRes = await db.collection('user')
        .where({ _openid: sellerOpenid })
        .field({ email: true })
        .limit(1)
        .get();

      if (userRes.data && userRes.data.length > 0 && userRes.data[0].email) {
        toEmail = userRes.data[0].email;
      }
    } catch (err) {
      console.error('查询卖家邮箱失败:', err);
    }
  }

  // 没有收件人邮箱则跳过
  if (!toEmail) {
    console.warn('未找到收件人邮箱，跳过发送');
    return { success: false, message: '收件人邮箱不存在' };
  }

  // 邮件格式校验
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(toEmail)) {
    console.warn('邮箱格式无效:', toEmail);
    return { success: false, message: '邮箱格式无效' };
  }

  // 获取模板
  const template = TEMPLATES[type] || TEMPLATES[1];

  // SMTP 配置
  const smtpConfig = {
    host: KEYS.EMAIL.sender.host || 'smtp.qq.com',
    port: KEYS.EMAIL.sender.port || 465,
    secure: KEYS.EMAIL.sender.secure !== false,
    auth: {
      user: KEYS.EMAIL.sender.user,
      pass: KEYS.EMAIL.sender.pass,
    },
  };

  let transporter;
  try {
    transporter = nodemailer.createTransport(smtpConfig);
  } catch (err) {
    console.error('创建SMTP客户端失败:', err);
    return { success: false, message: '邮件服务配置错误' };
  }

  const mail = {
    from: `${xcxname} <${smtpConfig.auth.user}>`,
    subject: template.subject,
    to: toEmail,
    html: template.body(title, xcxname),
  };

  try {
    const result = await transporter.sendMail(mail);
    console.log('邮件发送成功:', result);
    return { success: true, message: '发送成功', messageId: result.messageId };
  } catch (err) {
    console.error('邮件发送失败:', err);
    return { success: false, message: '发送失败: ' + err.message };
  }
};
