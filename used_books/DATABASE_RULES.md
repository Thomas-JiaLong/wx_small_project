# 云数据库安全规则配置说明

## 问题分析

用户反映不同用户无法看到列表数据，这是因为云数据库默认的安全规则限制了数据访问权限。默认情况下，云数据库只允许用户访问自己创建的数据（通过 `_openid` 字段进行匹配）。

## 解决方案

需要修改云数据库的安全规则，确保所有用户都能读取 `publish` 集合的数据，同时保持写入权限的控制。

## 操作步骤

### 1. 登录云开发控制台

1. 打开 [云开发控制台](https://console.cloud.tencent.com/tcb)
2. 选择对应的环境
3. 进入「数据库」页面

### 2. 修改 publish 集合的安全规则

1. 找到 `publish` 集合
2. 点击「安全规则」按钮
3. 将规则修改为以下内容：

```json
{
  "read": true,
  "write": "auth != null"
}
```

### 3. 修改其他相关集合的安全规则

#### books 集合（书籍信息）
```json
{
  "read": true,
  "write": "auth != null"
}
```

#### banner 集合（轮播图）
```json
{
  "read": true,
  "write": "auth != null"
}
```

#### user 集合（用户信息）
```json
{
  "read": "doc._openid == auth.openid",
  "write": "doc._openid == auth.openid"
}
```

#### order 集合（订单信息）
```json
{
  "read": "doc._openid == auth.openid",
  "write": "doc._openid == auth.openid"
}
```

#### history 集合（交易记录）
```json
{
  "read": "doc._openid == auth.openid",
  "write": "doc._openid == auth.openid"
}
```

#### conversations 和 messages 集合（聊天数据）
```json
{
  "read": "doc._openid == auth.openid || doc.receiverOpenid == auth.openid",
  "write": "auth != null"
}
```

## 规则说明

- `"read": true` - 允许所有用户读取数据
- `"write": "auth != null"` - 只允许登录用户写入数据
- `"read": "doc._openid == auth.openid"` - 只允许用户读取自己的数据
- `"write": "doc._openid == auth.openid"` - 只允许用户修改自己的数据

## 验证方法

1. 修改安全规则后，重新打开小程序
2. 使用不同用户登录测试
3. 确认所有用户都能看到完整的书籍列表

## 注意事项

- 安全规则修改后可能需要几分钟时间生效
- 确保只对需要公开访问的集合设置 `"read": true`
- 对于用户个人数据，保持严格的访问控制

## 技术支持

如果遇到问题，请参考 [云开发数据库安全规则文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/guide/database/security.html) 或联系技术支持。