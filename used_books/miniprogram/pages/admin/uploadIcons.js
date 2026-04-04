// pages/admin/uploadIcons.js
const app = getApp()

Page({
  data: {
    total: 0,
    uploaded: 0,
    failed: 0,
    logs: [],
    uploading: false
  },

  onLoad() {
    // 页面加载时不做任何操作，等待用户点击
  },

  async startUpload() {
    if (this.data.uploading) return

    this.setData({ 
      uploading: true, 
      uploaded: 0, 
      failed: 0,
      logs: ['开始上传图标...']
    })

    try {
      // 调用云函数获取图标数据并上传
      const res = await wx.cloud.callFunction({
        name: 'uploadIcons'
      })

      if (res.result) {
        const { success, failed, total } = res.result
        this.setData({ 
          uploaded: success || 0, 
          failed: failed || 0,
          total: total || 0
        })
        this.addLog(`上传完成! 成功: ${success}, 失败: ${failed}, 总计: ${total}`)
      }
    } catch (err) {
      this.addLog(`✗ 上传失败: ${err.message}`)
      console.error(err)
    }

    this.setData({ uploading: false })
  },

  addLog(msg) {
    const logs = this.data.logs
    logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`)
    this.setData({ logs })
    console.log(msg)
  },

  async clearAll() {
    const res = await wx.showModal({
      title: '确认清空',
      content: '确定要清空所有图标数据吗？'
    })

    if (!res.confirm) return

    const db = wx.cloud.database()
    const collection = db.collection('icons')
    
    try {
      const allDocs = await collection.get()
      for (const doc of allDocs.data) {
        await collection.doc(doc._id).remove()
      }
      this.addLog('已清空所有图标数据')
      this.setData({ uploaded: 0, failed: 0 })
    } catch (err) {
      this.addLog(`清空失败: ${err.message}`)
    }
  }
})
