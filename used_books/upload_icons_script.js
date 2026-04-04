/**
 * 上传图标到云数据库
 * 在小程序开发工具控制台运行此脚本
 */

const fs = require('fs');
const path = require('path');

// 图标数据
const iconsData = require('./icons_data.json');

// 分批上传，每批 5 个
async function uploadIcons() {
  const db = wx.cloud.database();
  const collection = db.collection('icons');
  
  const batchSize = 5;
  const results = [];
  
  for (let i = 0; i < iconsData.length; i += batchSize) {
    const batch = iconsData.slice(i, i + batchSize);
    
    for (const icon of batch) {
      try {
        // 检查是否已存在
        const existRes = await collection.where({
          name: icon.name
        }).get();
        
        if (existRes.data.length > 0) {
          // 更新
          await collection.doc(existRes.data[0]._id).update({
            data: {
              base64: icon.base64,
              type: icon.type,
              size: icon.size,
              updateTime: db.serverDate()
            }
          });
          console.log(`更新: ${icon.name}`);
          results.push({ name: icon.name, action: 'updated' });
        } else {
          // 新增
          await collection.add({
            data: {
              name: icon.name,
              base64: icon.base64,
              type: icon.type,
              size: icon.size,
              createTime: db.serverDate()
            }
          });
          console.log(`新增: ${icon.name}`);
          results.push({ name: icon.name, action: 'added' });
        }
      } catch (err) {
        console.error(`错误: ${icon.name}`, err);
        results.push({ name: icon.name, action: 'error', error: err.message });
      }
    }
    
    // 每批之间暂停 500ms
    if (i + batchSize < iconsData.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log('上传完成!', results);
  return results;
}

// 在控制台运行: uploadIcons()
