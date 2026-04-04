Page({
      data: {
            type: 'user',
            title: '用户协议'
      },

      onLoad(options) {
            if (options.type) {
                  this.setData({
                        type: options.type,
                        title: options.type === 'user' ? '用户协议' : '隐私政策'
                  });
            }
      },

      goBack() {
            wx.navigateBack();
      }
});
