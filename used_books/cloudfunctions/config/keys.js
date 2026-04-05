/**
 * ============================================
 *  培正舟海二手书交易平台 - 云函数配置中心
 * ============================================
 * 
 * 【重要】请在下方填入你的实际配置信息
 * 所有需要第三方Key的功能都集中在这里管理
 */

// ============================================
// 微信小程序配置 (必填)
// ============================================
const WECHAT = {
    // 小程序 AppID
    appId: '',                    // 示例: 'wx1234567890abcdef'
    
    // 小程序 AppSecret (请妥善保管，不要泄露)
    appSecret: '',                // 示例: 'abcdef1234567890abcdef1234567890'
    
    // 云开发环境ID
    cloudEnv: 'cloudbase-0g489v3baa95fd95',  // 示例: 'your-env-id-xxxxx'
};

// ============================================
// 微信支付配置 (可选)
// ============================================
const WXPAY = {
    // 启用微信支付
    enabled: false,               // true=启用, false=模拟充值
    
    // 服务商模式 - 如果你是服务商，需要填写以下信息
    sp: {
        // 服务商公众号 AppID (服务商)
        appid: '',                // 示例: 'wx1234567890abcdef'
        
        // 商户号 (服务商)
        mchid: '',                 // 示例: '1234567890'
        
        // 商户密钥 (服务商)
        partnerKey: '',            // 示例: 'abcdefghijklmnopqrstuvwxyz123456'
        
        // 服务商通知地址 (接收支付结果回调)
        notifyUrl: '',             // 示例: 'https://yourdomain.com/pay/notify'
    },
    
    // 子商户模式 - 如果你有子商户，需要填写以下信息
    sub: {
        // 子商户 AppID
        appId: '',                 // 示例: 'wxabcdef1234567890'
        
        // 子商户号
        mchid: '',                 // 示例: '9876543210'
    },
    
    // 支付结果通知地址
    notifyUrl: '',                // 示例: 'https://yourdomain.com/api/pay/notify'
};

// ============================================
// 短信服务配置 (可选) - 用于订单提醒
// ============================================
const SMS = {
    // 启用短信提醒
    enabled: false,               // true=启用, false=关闭
    
    // 腾讯云短信配置
    qcloud: {
        // SDK AppID
        appid: '',                // 示例: 1400123456
        
        // App Key
        appkey: '',               // 示例: 'abcdef1234567890abcdef12'
        
        // 短信签名 (需要在腾讯云申请)
        sign: '培正舟海',         // 示例: '【你的签名】'
        
        // 短信模板ID
        templateId: '',           // 示例: 123456
        
        // 发送的手机号
        phoneNumber: '',          // 示例: '13800138000'
    },
};

// ============================================
// 邮件服务配置 (可选) - 用于订单提醒
// ============================================
const EMAIL = {
    // 启用邮件提醒
    enabled: true,                // true=启用, false=关闭
    
    // 发送邮箱配置
    sender: {
        // SMTP 服务器地址
        host: 'smtp.qq.com',      // 示例: 'smtp.qq.com'
        
        // SMTP 端口
        port: 465,                // 示例: 465 (SSL) 或 587 (TLS)
        
        // 是否使用 SSL
        secure: true,             // true=SSL, false=TLS
        
        // 发送邮箱账号
        user: '3218921864@qq.com', // 示例: 'your-email@qq.com'
        
        // 发送邮箱密码/授权码 (不是登录密码!)
        pass: 'kvuxfwbeejdpdfde',  // 示例: 'abcdefghijklmnop'
        
        // 发件人名称
        name: '培正舟海二手书',    // 示例: '二手书平台'
    },
    
    // 接收邮箱 (管理员/卖家)
    receiver: {
        // 默认接收邮箱
        default: '',               // 示例: 'admin@example.com'
        
        // 是否发送给卖家 (由下单时传入)
        sendToSeller: true,
    },
};

// ============================================
// 豆瓣API配置 (可选) - 用于ISBN查询书籍信息
// ============================================
const DOUBAN = {
    // 启用豆瓣API查询
    enabled: true,                // true=启用, false=使用本地数据
    
    // API基础地址
    apiBase: 'https://api.douban.com/v2',
    
    // 请求超时时间(毫秒)
    timeout: 5000,
};

// ============================================
// 腾讯云对象存储COS配置 (可选)
// ============================================
const COS = {
    // 启用COS存储
    enabled: false,               // true=启用, false=使用云存储
    
    // COS配置
    cos: {
        // 地域
        Region: 'ap-guangzhou',   // 示例: 'ap-guangzhou'
        
        // Bucket 名称
        Bucket: '',                // 示例: 'mybucket-1251234567'
        
        // SecretId
        SecretId: '',              // 示例: 'AKIDxxxxxxxxxxxxxx'
        
        // SecretKey
        SecretKey: '',             // 示例: 'xxxxxxxxxxxxxxxx'
    },
};

// ============================================
// 其他配置
// ============================================
const OTHER = {
    // 订单有效期(天)
    orderExpireDays: 7,
    
    // 订单自动取消时间(天)
    autoCancelDays: 3,
    
    // 最大发布数量
    maxPublishCount: 50,
    
    // 是否开启调试日志
    debug: true,
};

// ============================================
// 导出配置
// ============================================
module.exports = {
    WECHAT,
    WXPAY,
    SMS,
    EMAIL,
    DOUBAN,
    COS,
    OTHER,
};
