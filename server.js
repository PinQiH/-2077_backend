const express = require("express")
const app = express()
require("dotenv").config()
const path = require("path")
const passport = require("passport")
const cookieParser = require("cookie-parser")
const Agent = require("agentkeepalive")
require("module-alias/register")
const db = require("./models/index.js")
const sequelize = db.sequelize
const port = process.env.PORT || 3000
const { sysErrorHandler, createLogger } = require("./middleware/errorHandler")
const { productTasks } = require("@cronJobs/productTasks")
const cors = require("cors")
require("express-async-errors")

const isDev = process.env.NODE_ENV === "development"
const logger = createLogger("./logs/server-%DATE%.log")
const keepAliveAgent = new Agent({
  maxSockets: Infinity,
  maxFreeSockets: Infinity,
  timeout: 60000,
  freeSocketTimeout: 30000,
})
if (process.env.NODE_ENV === "development") {
  // Development 環境
  app.use(
    cors({
      origin: "*", // 允許所有網域
      credentials: false, // 不需要攜帶憑證
    })
  )
} else {
  // Production 環境
  app.use(
    cors({
      origin: "https://2077-dashboard.onrender.com", // 允許的前端網址
      credentials: true, // 啟用攜帶憑證（如果需要，例如 Cookies 或 Authorization Header）
    })
  )
}
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(sysErrorHandler)
app.use(passport.initialize())
app.use(cookieParser())
app.set("keepAliveAgent", keepAliveAgent)
app.use("/public", express.static(path.join(__dirname, "/public")))

app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; img-src 'self' blob: 'self';connect-src 'self'; font-src 'self' data:; frame-src 'self';"
  )
  next()
})

function closeResourcesAndExit(code) {
  sequelize
    .close()
    .then(() => {
      logger.end(() => {
        process.exit(code)
      })
    })
    .catch((err) => {
      logger.log({
        level: "error",
        message: `Error while closing database connection: ${
          err.message || "Unknown error"
        }`,
        stack: err.stack || "No stack",
      })
      process.exit(code)
    })
}

process.on("beforeExit", closeResourcesAndExit)

const exitHandler = (err, eventName) => {
  console.log(`${eventName}: `, err)
  if (err) {
    logger.log({
      level: "error",
      message: `${eventName} occurred: ${err.message || "Unknown error"}`,
      stack: err.stack || "No stack",
    })
  }
  closeResourcesAndExit(1)
}

process.on("uncaughtException", (err) => {
  exitHandler(err, "Uncaught exception")
})

process.on("unhandledRejection", (err) => {
  exitHandler(err, "Unhandled rejection")
})

require("./routes")(app)

productTasks.start()

app.listen(port, () => {
  console.log(`後台程式已順利啟動 port:${port}`)

  // 取得伺服器對象
  const server = app.listen()

  // 設置超時時間為20分鐘
  server.timeout = 1200000
})
