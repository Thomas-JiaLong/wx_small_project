const db = wx.cloud.database();
const app = getApp();
const config = require("../../config.js");

Page({
      data: {
            ids: -1,
            wxnum: '',
            qqnum: '',
            email: '',
            campus: JSON.parse(config.data).campus,
            isSubmitting: false,
      },

      onLoad() {
            // 设置导航栏颜色
            wx.setNavigationBarColor({
                  frontColor: '#ffffff',
                  backgroundColor: '#667eea',
            });
      },

      onUnload() {
            // 恢复导航栏颜色
            wx.setNavigationBarColor({
                  frontColor: '#ffffff',
                  backgroundColor: '#3498db',
            });
      },

      // 选择校区
      choose(e) {
            this.setData({ ids: e.detail.value });
      },

      // 输入事件
      wxInput(e) {
            this.setData({ wxnum: e.detail.value });
      },
      
      qqInput(e) {
            this.setData({ qqnum: e.detail.value });
      },
      
      emInput(e) {
            this.setData({ email: e.detail.value });
      },

      // 校验
      validate() {
            const { ids, email, wxnum, qqnum, campus } = this.data;

            // 校验校区
            if (ids == -1) {
                  wx.showToast({ title: '请选择校区', icon: 'none' });
                  return false;
            }

            // 校验邮箱
            const emailReg = /^\w+((.\w+)|(-\w+))@[A-Za-z0-9]+((.|-)[A-Za-z0-9]+).[A-Za-z0-9]+$/;
            if (!emailReg.test(email)) {
                  wx.showToast({ title: '请输入正确的邮箱', icon: 'none' });
                  return false;
            }

            // 校验微信号
            if (!wxnum) {
                  wx.showToast({ title: '请输入微信号', icon: 'none' });
                  return false;
            }
            const wxReg = /^[a-zA-Z][a-zA-Z0-9_-]{5,19}$/;
            if (!wxReg.test(wxnum)) {
                  wx.showToast({ title: '微信号格式不正确', icon: 'none' });
                  return false;
            }

            // 校验QQ号（选填）
            if (qqnum && !/^\d{5,11}$/.test(qqnum)) {
                  wx.showToast({ title: 'QQ号格式不正确', icon: 'none' });
                  return false;
            }

            return true;
      },

      // 获取用户信息并注册
      getUserInfo(e) {
            if (this.data.isSubmitting) return;

            // 检查授权
            if (e.detail.errMsg.indexOf("ok") === -1) {
                  wx.showToast({ title: '请授权后使用', icon: 'none' });
                  return;
            }

            // 校验表单
            if (!this.validate()) return;

            // 防重复提交
            this.setData({ isSubmitting: true });

            const { ids, wxnum, qqnum, email, campus, userInfo } = this.data;

            wx.showLoading({ title: '注册中...', mask: true });

            db.collection('user').add({
                  data: {
                        campus: campus[ids],
                        qqnum,
                        email,
                        wxnum,
                        stamp: Date.now(),
                        info: e.detail.userInfo,
                        useful: true,
                        parse: 0, // 初始余额为0
                  },
            })
            .then(res => {
                  return db.collection('user').doc(res._id).get();
            })
            .then(res => {
                  app.userinfo = res.data;
                  app.openid = res.data._openid;
                  
                  wx.hideLoading();
                  wx.showToast({ 
                        title: '注册成功', 
                        icon: 'success',
                        duration: 1500 
                  });
                  
                  setTimeout(() => {
                        wx.navigateBack();
                  }, 1500);
            })
            .catch(err => {
                  console.error('注册失败', err);
                  wx.hideLoading();
                  wx.showToast({ title: '注册失败，请重试', icon: 'none' });
                  this.setData({ isSubmitting: false });
            });
      },
})
