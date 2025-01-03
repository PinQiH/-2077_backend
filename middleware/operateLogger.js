const winston = require("winston")
require("winston-daily-rotate-file")
const db = require("../models")

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({
      format: () =>
        new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }),
    }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.colorize({ all: true }),
    }),
    new winston.transports.DailyRotateFile({
      filename: `./logs/operateLogs-%DATE%.log`,
      datePattern: "YYYY-MM-DD",
      zippedArchive: process.env.ARCHIVE_LOG === "true",
      maxSize: null,
      maxFiles: null,
    }),
  ],
})

const operateLogger = async (req, res, next) => {
  const connectCountData = await db.sequelize.query(
    "SELECT COUNT(*) FROM pg_stat_activity"
  )
  const connectCount = connectCountData[0][0].count
  logger.info({
    message: `Route accessed: ${req.method} ${req.url}`,
    user: req.user?.email || req.body?.email || "guest",
    userIP: req.headers["x-forwarded-for"] || req.connection.remoteAddress,
    userLanguage: req.headers["accept-language"],
    userAgent: req.headers["user-agent"],
    dbConnectCount: connectCount,
  })
  next()
}

module.exports = operateLogger
