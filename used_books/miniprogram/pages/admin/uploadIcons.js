const app = getApp();
const iconManager = require('../../utils/iconManager.js');

Page({
      data: {
            images: [],
            logs: [],
            uploading: false
      },

      onLoad() {
            app.ensureCloudReady();
      },

      // 选择图片
      selectImages() {
            wx.chooseImage({
                  count: 9,
                  sizeType: ['original', 'compressed'],
                  sourceType: ['album', 'camera'],
                  success: (res) => {
                        const newImages = res.tempFilePaths.map(path => ({
                              path,
                              key: ''
                        }));
                        this.setData({
                              images: [...this.data.images, ...newImages]
                        });
                  }
            });
      },

      // 更新图标键名
      updateKey(e) {
            const index = e.currentTarget.dataset.index;
            const key = e.detail.value;
            const images = [...this.data.images];
            images[index].key = key;
            this.setData({ images });
      },

      // 移除图片
      removeImage(e) {
            const index = e.currentTarget.dataset.index;
            const images = [...this.data.images];
            images.splice(index, 1);
            this.setData({ images });
      },

      // 批量上传
      async uploadAll() {
            if (this.data.uploading) return;
            
            const validImages = this.data.images.filter(item => item.key);
            if (validImages.length === 0) {
                  wx.showToast({ title: '请输入图标键名', icon: 'none' });
                  return;
            }

            this.setData({ uploading: true, logs: [] });

            try {
                  const iconMap = {};
                  validImages.forEach(item => {
                        iconMap[item.key] = item.path;
                  });

                  const results = await iconManager.batchUploadIcons(iconMap);
                  
                  this.setData({
                        logs: results,
                        images: []
                  });

                  wx.showToast({ title: '上传完成', icon: 'success' });
            } catch (err) {
                  console.error('上传失败:', err);
                  wx.showToast({ title: '上传失败', icon: 'none' });
            } finally {
                  this.setData({ uploading: false });
            }
      }
});
