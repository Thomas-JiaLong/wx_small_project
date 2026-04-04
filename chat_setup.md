# 聊天功能数据库设置

## 需要创建的云数据库集合

### 1. conversations（会话表）

**权限配置：** 见下面详细说明

| 字段 | 类型 | 说明 |
|------|------|------|
| participants | Array | 参与者 openid 列表 |
| participantNames | Object | 参与者昵称 {openid: name} |
| participantAvatars | Object | 参与者头像 {openid: avatar} |
| bookId | String | 关联的书籍ID |
| bookTitle | String | 关联的书籍标题 |
| lastMsg | String | 最后一条消息 |
| lastTime | Number | 最后消息时间戳 |
| unread | Number | 未读消息数 |
| createTime | Number | 创建时间 |

**权限设置（重要）：**
- 数据权限选择「仅创建者及管理员可写」
- 或在「权限设置」中自定义：
  ```
  read: doc._openid == openid || participants.indexOf(openid) != -1
  create: true
  update: doc._openid == openid || participants.indexOf(openid) != -1
  delete: doc._openid == openid
  ```

### 2. messages（消息表）

| 字段 | 类型 | 说明 |
|------|------|------|
| conversationId | String | 所属会话ID |
| senderId | String | 发送者 openid |
| type | String | 消息类型：text/image |
| content | String | 消息内容 |
| createTime | Number | 创建时间戳 |
| read | Boolean | 是否已读 |

**权限设置：**
```
read: doc._openid == openid || participants.indexOf(openid) != -1
create: true
update: doc._openid == openid
delete: doc._openid == openid
```

---

## 部署云函数

1. 打开 `cloudfunctions/chat` 文件夹
2. 右键 → 「上传并部署」
3. 如果提示依赖问题，选「安装依赖」

---

## 功能入口

- **我的页面** → 新增「消息」入口
- **书籍详情页** → 底部新增「联系」按钮
