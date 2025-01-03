const winston = require("winston")
const prettyjson = require("prettyjson")
require("winston-daily-rotate-file")
const {
  ValidationError,
  DatabaseConflictError,
  PermissionError,
  ThirdPartyApiError,
} = require("@utils/error")

function createLogger(filename) {
  return winston.createLogger({
    level: "error",
    format: winston.format.combine(
      winston.format.timestamp({
        format: () =>
          new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }),
      }),
      winston.format.printf((info) => {
        const { timestamp, level, message, ...args } = info

        const formattedStack = args.stack
          ? args.stack
              .split("\n")
              .map((line) => `    ${line}`)
              .join("\n")
          : ""

        return `[${timestamp}] [${level}]: ${message}\n${formattedStack}\n${JSON.stringify(
          args,
          null,
          2
        )}`
      })
    ),
    transports: [
      new winston.transports.DailyRotateFile({
        filename: filename,
        datePattern: "YYYY-MM-DD",
        zippedArchive: process.env.ARCHIVE_LOG === "true",
        maxSize: null,
        maxFiles: null,
        level: "error",
      }),
    ],
  })
}

const generalLogger = createLogger(`./logs/generalErrors-%DATE%.log`)
const systemLogger = createLogger(`./logs/systemErrors-%DATE%.log`)
const GENERIC_ERROR_MESSAGE =
  "很抱歉，您遇到了一個錯誤，請聯繫我們的技術支援團隊以尋求協助，謝謝。"

function createErrorInfo(req, err, isSysError) {
  return {
    message: err.message,
    method: req.method,
    url: req.url,
    user: req.user?.email,
    userIP: req.headers["x-forwarded-for"] || req.connection.remoteAddress,
    userLanguage: req.headers["accept-language"],
    userAgent: req.headers["user-agent"],
    stack: isSysError ? err.stack : undefined,
  }
}

function logAndSendError(
  req,
  res,
  err,
  logger,
  statusCode,
  isSysError = false
) {
  const errorInfo = createErrorInfo(req, err, isSysError)
  logger.error(errorInfo)

  const options = {
    keysColor: "red", // 設定鍵的顏色
    dashColor: "red", // 設定破折號的顏色
    stringColor: "red", // 設定字串值的顏色
  }
  console.error("\n\n" + "=============== ERROR START ===============\n")
  console.error(prettyjson.render(errorInfo, options))
  console.error("\n" + "=============== ERROR END ===============\n\n")

  if (statusCode === 500 && !process.env.DEBUG_MODE === "true") {
    err.message = GENERIC_ERROR_MESSAGE
  }

  switch (err.code) {
    case "RATE_LIMIT_EXCEEDED_ERROR":
      err.message = "請求過於頻繁，請稍後再試。"
      break
    default:
      break
  }

  if (err.code) {
    return res.status(statusCode).json({
      rtnCode: err.code,
      rtnMsg: err.message,
      data: err.data,
    })
  } else {
    return res.status(statusCode).json({
      rtnCode: req.route.stack.slice(-1)[0].name.toUpperCase() + "_ERROR",
      rtnMsg: err.message,
      data: err.data,
    })
  }
}

module.exports = {
  errorHandler(err, req, res, next) {
    if (res.headersSent) {
      return next(err)
    }

    const statusCode = (() => {
      switch (err.code) {
        case "AUTH_REQUIRED":
          return 401
        case "IP_MISMATCH":
        case "ACCOUNT_DISABLED":
        case "PERMISSION_DENIED":
          return 403
        default:
          return 403
      }
    })()

    switch (true) {
      case err instanceof ValidationError:
        logAndSendError(req, res, err, generalLogger, 400)
        break
      case err instanceof DatabaseConflictError:
        logAndSendError(req, res, err, generalLogger, 409)
        break
      case err instanceof PermissionError:
        logAndSendError(req, res, err, generalLogger, statusCode)
        break
      case err instanceof ThirdPartyApiError:
        logAndSendError(req, res, err, generalLogger, 502)
        break
      default:
        logAndSendError(req, res, err, systemLogger, 500, true)
        break
    }
  },
  sysErrorHandler(err, req, res, next) {
    if (res.headersSent) {
      return next(err)
    }
    logAndSendError(req, res, err, systemLogger, 500, true)
    return res.status(500).end()
  },
  createLogger,
}
