// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 内置图标数据（由 prepare_icons.js 生成）
const ICONS_DATA = require('./icons_data.json')

// 云函数入口函数
exports.main = async (event, context) => {
  const db = cloud.database()
  const collection = db.collection('icons')
  
  let success = 0
  let failed = 0
  
  for (const icon of ICONS_DATA) {
    try {
      // 检查是否已存在
      const existRes = await collection.where({
        name: icon.name
      }).get()
      
      if (existRes.data.length > 0) {
        // 更新
        await collection.doc(existRes.data[0]._id).update({
          data: {
            base64: icon.base64,
            type: icon.type,
            size: icon.size,
            updateTime: db.serverDate()
          }
        })
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
        })
      }
      success++
    } catch (err) {
      console.error(`上传图标失败: ${icon.name}`, err)
      failed++
    }
  }
  
  return {
    success,
    failed,
    total: ICONS_DATA.length
  }
}
