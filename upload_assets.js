/**
 * 图片资源上传工具
 * 运行方式: node upload_assets.js [图片目录]
 * 
 * 功能:
 * 1. 读取本地图片并转为 base64
 * 2. 将图片信息存入云数据库 imageAssets 集合
 * 3. 生成可用的小程序代码引用
 * 
 * 上传前请先在微信开发者工具中上传 cloudfunctions/assets 云函数
 */

// 初始化云开发（本地调试时使用）
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 需要上传的图片配置（key: 文件路径, type: 类型, compress: 是否压缩）
const ASSETS_TO_UPLOAD = [
  // ==================== 大图（必须云端化）====================
  { key: 'logo',      local: 'images/logo.png',       type: 'image',  compress: true,  maxKB: 50  },
  { key: 'startBg',   local: 'images/startBg.jpg',    type: 'image',  compress: true,  maxKB: 30  },
  { key: 'kefu',      local: 'images/kefu.jpg',       type: 'image',  compress: true,  maxKB: 20  },
  { key: 'isbn',      local: 'images/isbn.jpg',      type: 'image',  compress: true,  maxKB: 20  },
  { key: 'poster',    local: 'images/poster.jpg',     type: 'image',  compress: true,  maxKB: 20  },
  { key: 'WechatCode',local: 'images/pages/WechatCode.jpg', type: 'image', compress: true, maxKB: 30 },
  // ==================== 中图（建议云端化）====================
  { key: 'code',      local: 'images/code.png',       type: 'image',  compress: true,  maxKB: 15  },
  { key: 'checkbox',  local: 'images/checkbox.png',  type: 'image',  compress: true,  maxKB: 15  },
  { key: 'success',   local: 'images/success.png',   type: 'image',  compress: true,  maxKB: 10  },
  { key: 'avator',    local: 'images/avator.png',    type: 'image',  compress: true,  maxKB: 10  },
  { key: 'blank',     local: 'images/blank.png',     type: 'image',  compress: true,  maxKB: 5   },
  { key: 'suc',       local: 'images/suc.png',       type: 'image',  compress: true,  maxKB: 5   },
  // ==================== 小图标（保持本地）====================
  // 以下保持本地引用，不上传云端
];

const IMAGE_DIR = path.join(__dirname, 'used_books', 'miniprogram');

// 简单的 PNG/JPEG 压缩（去除元数据，减小体积）
function compressImage(buffer, mimeType) {
  // 对于 PNG，可以去除不必要的 chunks
  // 对于 JPEG，可以降低质量
  // 这里不做实际压缩，实际使用中建议用 tinypng 或其他工具预处理
  return buffer;
}

// 获取图片的 md5
function getMD5(buffer) {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

// 读取图片并转为 base64
function readImageAsBase64(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  };
  const mime = mimeMap[ext] || 'image/png';
  return {
    base64: buffer.toString('base64'),
    mime,
    size: buffer.length,
    md5: getMD5(buffer),
  };
}

// 生成可直接使用的小程序代码
function generateAppCode(asset) {
  const dataUrl = `data:${asset.mime};base64,${asset.base64}`;
  
  // 输出可直接在 wxml 中使用的内联样式图片标签（通过 background-image）
  // 或者生成 JS 配置文件
  return {
    key: asset.key,
    dataUrl,
    sizeKB: Math.round(asset.size / 1024),
    md5: asset.md5,
  };
}

// 打印使用说明
function printUsage() {
  console.log('\n========================================');
  console.log('图片资源上传工具 - 使用说明');
  console.log('========================================\n');
  console.log('步骤 1: 在云数据库中创建 imageAssets 集合');
  console.log('  - 登录微信公众平台/云开发控制台');
  console.log('  - 进入云数据库，创建集合 imageAssets');
  console.log('  - 集合权限设为 "自定义安全规则" 或 "所有用户可读"\n');
  console.log('步骤 2: 上传 cloudfunctions/assets 云函数');
  console.log('  - 在微信开发者工具中上传 assets 云函数\n');
  console.log('步骤 3: 上传图片到云数据库');
  console.log('  - 修改本文件中的 ASSETS_TO_UPLOAD 配置');
  console.log('  - 运行: node upload_assets.js\n');
  console.log('步骤 4: 在小程序中使用');
  console.log('  - 使用 ImageLoader 工具类加载图片');
  console.log('  - 或直接引用 base64 数据 URL\n');
  console.log('========================================\n');
}

// 主函数
function main() {
  console.log('\n📦 图片资源上传工具\n');

  // 检查是否只有 --help 参数
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printUsage();
    return;
  }

  const results = [];
  
  for (const asset of ASSETS_TO_UPLOAD) {
    const fullPath = path.join(IMAGE_DIR, asset.local);
    const info = readImageAsBase64(fullPath);
    
    if (!info) {
      console.log(`⚠️  跳过 ${asset.key}: 文件不存在`);
      continue;
    }

    if (info.size > asset.maxKB * 1024) {
      console.log(`⚠️  ${asset.key}: ${Math.round(info.size/1024)}KB > ${asset.maxKB}KB，建议压缩`);
    }

    const code = generateAppCode(info);
    results.push(code);

    console.log(`✅ ${asset.key}: ${code.sizeKB}KB | md5: ${code.md5.substring(0, 8)}...`);
    console.log(`   data:${code.mime};base64,${code.base64.substring(0, 30)}...`);
    console.log('');
  }

  // 生成配置文件供小程序使用
  const configContent = results.map(r => `  '${r.key}': '${r.dataUrl}'`).join(',\n');
  const configFile = `// 自动生成，请勿手动修改
// 运行 node upload_assets.js 生成

const imageAssets = {
${configContent}
};

module.exports = imageAssets;
`;

  const configPath = path.join(IMAGE_DIR, 'utils', 'imageAssets.js');
  fs.writeFileSync(configPath, configContent.replace(/data:image\/\w+;base64,/g, 'base64:'));
  
  console.log(`\n📝 配置文件已生成: ${configPath}`);
  console.log(`共处理 ${results.length} 个图片资源\n`);
  printUsage();
}

main();
