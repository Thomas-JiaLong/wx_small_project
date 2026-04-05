// 测试不同用户访问列表的脚本
const cloud = require('wx-server-sdk');

// 初始化云开发
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 测试不同用户访问列表
async function testUserAccess() {
  try {
    console.log('=== 测试不同用户访问列表 ===');
    
    // 1. 测试当前用户读取publish集合
    console.log('\n1. 测试当前用户读取publish集合:');
    const result = await db.collection('publish').limit(5).get();
    console.log('当前用户读取到的数据:', result.data);
    console.log('读取数量:', result.data.length);
    
    // 2. 测试查询条件
    console.log('\n2. 测试带条件的查询:');
    const filteredResult = await db.collection('publish')
      .where({
        status: 0,
        dura: db.command.gt(Date.now())
      })
      .orderBy('creat', 'desc')
      .limit(5)
      .get();
    console.log('带条件查询结果:', filteredResult.data);
    console.log('符合条件的数量:', filteredResult.data.length);
    
    // 3. 测试books集合读取
    console.log('\n3. 测试读取books集合:');
    const booksResult = await db.collection('books').limit(3).get();
    console.log('books集合数据:', booksResult.data);
    
    // 4. 测试banner集合读取
    console.log('\n4. 测试读取banner集合:');
    const bannerResult = await db.collection('banner').get();
    console.log('banner集合数据:', bannerResult.data);
    
    console.log('\n=== 测试完成 ===');
    console.log('如果能看到数据，说明安全规则配置正确');
    console.log('如果看不到数据，说明安全规则需要修改');
    
  } catch (error) {
    console.error('测试失败:', error);
    console.log('\n=== 错误分析 ===');
    console.log('如果出现权限错误，说明安全规则限制了访问');
    console.log('请按照 DATABASE_RULES.md 中的说明修改安全规则');
  }
}

// 运行测试
testUserAccess().then(() => {
  console.log('\n测试完成');
}).catch(err => {
  console.error('测试出错:', err);
});