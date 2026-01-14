const pino = require("pino");
const fs = require("fs");
const path = require("path");

// Ensure logs directory exists
const logDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const transport = pino.transport({
  targets: [
    {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
      },
    },
    {
      target: "pino/file",
      options: {
        destination: path.join(logDir, "app.log"),
        mkdir: true,
      },
    },
  ],
});

const logger = pino(
  {
    level: process.env.LOG_LEVEL || "info",
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  transport
);

module.exports = logger;
