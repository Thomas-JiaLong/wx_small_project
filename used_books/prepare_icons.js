/**
 * 将图片图标转换为 base64 并生成上传数据
 * 运行方式: node prepare_icons.js
 */

const fs = require('fs');
const path = require('path');

const imagesDir = path.join(__dirname, 'miniprogram', 'images');
const outputFile = path.join(__dirname, 'icons_data.json');

// 支持的图片类型
const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif'];

// MIME 类型映射
const mimeTypes = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif'
};

// 最大文件大小 (200KB)
const maxSize = 200 * 1024;

function getBase64Icon(filePath, fileName) {
  const ext = path.extname(fileName).toLowerCase();
  const mimeType = mimeTypes[ext];
  
  if (!mimeType) return null;
  
  const fileBuffer = fs.readFileSync(filePath);
  const size = fileBuffer.length;
  
  if (size > maxSize) {
    console.log(`跳过 (超过200KB): ${fileName} (${(size / 1024).toFixed(1)}KB)`);
    return null;
  }
  
  const base64 = fileBuffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64}`;
  
  return {
    name: path.basename(fileName, ext),
    base64: dataUrl,
    type: ext.slice(1),
    size: size
  };
}

function main() {
  const icons = [];
  
  // 读取所有图片文件
  const files = fs.readdirSync(imagesDir);
  
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!imageExtensions.includes(ext)) continue;
    
    const filePath = path.join(imagesDir, file);
    const stat = fs.statSync(filePath);
    
    if (!stat.isFile()) continue;
    
    const iconData = getBase64Icon(filePath, file);
    if (iconData) {
      icons.push(iconData);
      console.log(`处理: ${file} (${(iconData.size / 1024).toFixed(1)}KB)`);
    }
  }
  
  // 写入输出文件
  fs.writeFileSync(outputFile, JSON.stringify(icons, null, 2), 'utf8');
  
  console.log(`\n完成! 共 ${icons.length} 个图标`);
  console.log(`输出文件: ${outputFile}`);
  console.log(`总大小: ${(icons.reduce((sum, i) => sum + i.size, 0) / 1024).toFixed(1)}KB`);
}

main();
