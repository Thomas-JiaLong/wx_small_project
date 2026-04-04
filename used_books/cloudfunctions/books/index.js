const cloud = require('wx-server-sdk')
const TcbRouter = require('tcb-router');
const rq = require('request');
cloud.init()

// 云函数入口函数
exports.main = async (event, context) => {
      const app = new TcbRouter({
            event
      });

      // 根据isbn码获取图书详情信息
      app.router('bookinfo', async (ctx) => {
            try {
                  const { isbn } = event;

                  // 参数校验
                  if (!isbn) {
                        ctx.body = {
                              code: 400,
                              message: 'ISBN不能为空'
                        };
                        return;
                  }

                  // 调用第三方API获取图书信息
                  const result = await new Promise((resolve, reject) => {
                        rq({
                              url: `https://api.jisuapi.com/isbn/query?appkey=3cc611d84d398fb4&isbn=${isbn}`,
                              method: "GET",
                              json: true,
                              timeout: 10000 // 10秒超时
                        }, function (error, response, body) {
                              if (error) {
                                    reject(error);
                                    return;
                              }
                              if (response.statusCode !== 200) {
                                    reject(new Error(`HTTP ${response.statusCode}`));
                                    return;
                              }
                              resolve(body);
                        });
                  });

                  ctx.body = {
                        code: 200,
                        body: result
                  };

            } catch (error) {
                  console.error('获取图书信息失败:', error);
                  ctx.body = {
                        code: 500,
                        message: '获取图书信息失败',
                        error: error.message
                  };
            }
      });

      return app.serve();
}
