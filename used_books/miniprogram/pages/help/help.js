var app = getApp();
let db;

Page({
      /**
       * 页面的初始数据
       */
      data: {
            list: [{
                  title: '该程序是做什么的？',
                  id: 0,
                  des: ['本程序主要是方便培正学院的朋友发布自己不要了的二手书的。',
                        '如果您是其它学校得同学，可以访问【关于程序】页面咨询作者'
                  ],
                  check: true,
            }, {
                  title: '该程序收费吗？',
                  id: 1,
                  des: ['本程序是完全的公益项目，永久承诺不收取任何中介费，您可以随心所欲的发布自己的书籍和购买'],
                  check: false,
            }, {
                  title: '为什么要留下联系方式？',
                  id: 2,
                  des: ['本程序交易完全由交易双方沟通。', '除非程序出现问题导致交易故障，平台不参与任何交易'],
                  check: false,
            }, {
                  title: '交易中途取消后，钱款会自动到微信钱包吗？',
                  id: 3,
                  des: ['如果卖家取消了交易或者您取消了订单，钱款都会原数退还至您在此小程序的钱包内，最后需要您手动提现一下才能转出到余额'],
                  check: false,
            }, {
                  title: '本程序的通知形式？',
                  id: 4,
                  des: ['对于买家下单时，我们会发送邮件给卖家，通知他尽快发货','当交易状态中途取消时，仅以邮件通知对方','您可以在订单详情页面通过买（卖）家留下的联系方式第一时间联系，这样更能提高效率'],
                  check: false,
            }, ]
      },
      onReady() {},

      show(e) {
            var that = this;
            let ite = e.currentTarget.dataset.show;
            let list = that.data.list;
            if (!ite.check) {
                  list[ite.id].check = true;
            } else {
                  list[ite.id].check = false;
            }
            that.setData({
                  list: list
            })
      },
      //跳转页面
      go(e) {
            wx.navigateTo({
                  url: e.currentTarget.dataset.go
            })
      },
      onLoad() {
            // 等待云开发初始化完成后再执行
            app.ensureCloudReady().then(() => {
                  db = wx.cloud.database();
            });
      },

})