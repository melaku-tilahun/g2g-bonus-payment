const { AsyncLocalStorage } = require("node:async_hooks");

const contextStorage = new AsyncLocalStorage();

const RequestContext = {
  run: (context, callback) => contextStorage.run(context, callback),
  get: () => contextStorage.getStore(),

  middleware: (req, res, next) => {
    const context = {
      userId: req.user?.id || null,
      ip: req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress,
      requestId: Math.random().toString(36).substring(7),
    };

    contextStorage.run(context, next);
  },
};

module.exports = RequestContext;
