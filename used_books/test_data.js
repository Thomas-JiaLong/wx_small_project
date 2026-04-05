// 测试数据结构的脚本
const cloud = require('wx-server-sdk');

// 初始化云开发
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 测试publish集合数据
async function testPublishData() {
  try {
    console.log('=== 测试publish集合数据 ===');
    
    // 查询publish集合数据
    const result = await db.collection('publish').limit(10).get();
    
    console.log('查询到的publish数据:', result.data);
    
    if (result.data.length > 0) {
      console.log('\n=== 数据结构分析 ===');
      const firstItem = result.data[0];
      console.log('数据字段:', Object.keys(firstItem));
      console.log('示例数据:', firstItem);
    } else {
      console.log('publish集合为空');
    }
    
    // 测试读取权限
    console.log('\n=== 测试读取权限 ===');
    console.log('读取操作成功，说明当前用户有读取权限');
    
  } catch (error) {
    console.error('测试失败:', error);
  }
}

// 运行测试
testPublishData().then(() => {
  console.log('\n测试完成');
}).catch(err => {
  console.error('测试出错:', err);
});