const app = getApp();

class IconManager {
      constructor() {
            this.db = null;
            this.icons = {};
            this.isInitialized = false;
      }

      // 初始化
      async init() {
            if (this.isInitialized) return;
            
            await app.ensureCloudReady();
            this.db = wx.cloud.database();
            this.isInitialized = true;
            await this.loadIcons();
      }

      // 加载所有图标
      async loadIcons() {
            try {
                  const res = await this.db.collection('icons').get();
                  res.data.forEach(item => {
                        this.icons[item.key] = item.data;
                  });
                  console.log('图标加载成功:', Object.keys(this.icons).length);
            } catch (err) {
                  console.error('加载图标失败:', err);
            }
      }

      // 获取图标
      async getIcon(key) {
            await this.init();
            
            if (this.icons[key]) {
                  return this.icons[key];
            }

            // 从数据库中获取
            try {
                  const res = await this.db.collection('icons').where({ key }).get();
                  if (res.data.length > 0) {
                        this.icons[key] = res.data[0].data;
                        return this.icons[key];
                  }
            } catch (err) {
                  console.error('获取图标失败:', err);
            }

            // 返回默认图标
            return this.getDefaultIcon();
      }

      // 上传图标
      async uploadIcon(key, filePath) {
            await this.init();

            try {
                  // 读取文件内容
                  const fileContent = await this.readFile(filePath);
                  const base64Data = wx.arrayBufferToBase64(fileContent);
                  
                  // 检查是否已存在
                  const res = await this.db.collection('icons').where({ key }).get();
                  
                  if (res.data.length > 0) {
                        // 更新
                        await this.db.collection('icons').doc(res.data[0]._id).update({
                              data: { data: base64Data, updatedAt: Date.now() }
                        });
                  } else {
                        // 新增
                        await this.db.collection('icons').add({
                              data: { key, data: base64Data, createdAt: Date.now(), updatedAt: Date.now() }
                        });
                  }
                  
                  this.icons[key] = base64Data;
                  console.log('图标上传成功:', key);
                  return true;
            } catch (err) {
                  console.error('上传图标失败:', err);
                  return false;
            }
      }

      // 读取文件
      readFile(filePath) {
            return new Promise((resolve, reject) => {
                  wx.getFileSystemManager().readFile({
                        filePath,
                        success: res => resolve(res.data),
                        fail: reject
                  });
            });
      }

      // 获取默认图标
      getDefaultIcon() {
            // 返回一个默认的base64图标
            return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      }

      // 批量上传图标
      async batchUploadIcons(iconMap) {
            const results = [];
            for (const [key, filePath] of Object.entries(iconMap)) {
                  const success = await this.uploadIcon(key, filePath);
                  results.push({ key, success });
            }
            return results;
      }
}

// 导出单例
module.exports = new IconManager();
