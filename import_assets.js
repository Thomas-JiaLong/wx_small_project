/**
 * 云端图片资源导入工具
 * 
 * 使用方式：
 * 1. 先在云开发控制台创建 imageAssets 集合
 * 2. 在微信开发者工具中上传 assets 云函数
 * 3. 运行此文件导入数据到云数据库
 * 
 * 运行：node import_assets.js
 * 
 * 或者手动导入：
 * 将 cloud_assets_records.json 中的记录逐条添加到云数据库 imageAssets 集合
 */

const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, 'used_books', 'miniprogram');
const assetsFile = path.join(__dirname, 'cloud_assets.json');
const recordsFile = path.join(__dirname, 'cloud_assets_records.json');

if (!fs.existsSync(assetsFile)) {
  console.error('cloud_assets.json 不存在，请先运行 generate_assets.ps1');
  process.exit(1);
}

const assets = JSON.parse(fs.readFileSync(assetsFile, 'utf8'));

// 生成云数据库记录格式
const records = Object.entries(assets).map(([key, asset]) => ({
  key,
  filename: asset.filename,
  mime: asset.mime,
  size: asset.size,
  base64: asset.base64,
  // 兼容小程序 Image 组件的 data URL
  dataUrl: `data:${asset.mime};base64,${asset.base64}`,
  // 推荐：上传到云存储后填入 fileID
  cloudFileId: '',
}));

// 保存为易导入的格式
fs.writeFileSync(recordsFile, JSON.stringify(records, null, 2), 'utf8');

console.log('\n========================================');
console.log('📦 云端图片资源导入');
console.log('========================================\n');

// 计算各类型占比
const total = Object.values(assets).reduce((sum, a) => sum + a.size, 0);
const totalB64 = Object.values(assets).reduce((sum, a) => sum + a.base64.length, 0);

console.log(`原始图片大小: ${(total / 1024).toFixed(1)} KB`);
console.log(`Base64 字符串大小: ${(totalB64 / 1024).toFixed(1)} KB`);
console.log(`Base64 膨胀率: ${(totalB64 / total).toFixed(2)}x\n`);

console.log('图片列表:');
Object.entries(assets).forEach(([key, asset]) => {
  console.log(`  ${key.padEnd(12)} ${(asset.size / 1024).toFixed(1).padStart(6)} KB  ->  base64: ${(asset.base64.length / 1024).toFixed(1).padStart(6)} KB`);
});

console.log(`\n已生成 ${records.length} 条记录: ${recordsFile}`);
console.log('\n========================================');
console.log('📋 导入步骤（两种方式）');
console.log('========================================\n');
console.log('方式一：手动导入（推荐）');
console.log('1. 打开微信开发者工具 -> 云开发控制台');
console.log('2. 进入数据库 -> imageAssets 集合');
console.log('3. 添加记录，字段：');
console.log('   - key: string (如 "logo")');
console.log('   - base64: string (复制 cloud_assets_records.json 中的值)');
console.log('   - mime: string (如 "image/png")');
console.log('   - filename: string (如 "logo.png")\n');
console.log('方式二：代码导入（需要修改）');
console.log('1. 在 app.js 中初始化时调用此工具的导入逻辑');
console.log('2. 使用云函数批量写入数据库\n');
console.log('========================================');
console.log('⚠️  注意：');
console.log('- Base64 会比原图大约 33%');
console.log('- 建议先上传图片到云存储，数据库只存 fileID');
console.log('- 大图片（>50KB）不建议使用 base64');
console.log('========================================\n');
