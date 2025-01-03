const fs = require("fs")
const path = require("path")
require("dotenv").config()

async function sendMail(mailOptions, options = {}) {
  if (!options.MAIL_AC || !options.MAIL_PW) {
    throw new Error("請提供帳號密碼(MAIL_AC, MAIL_PW)")
  }

  //注意這裡是字串 "true" 或 "false"，不是布林值
  const useSSL = options.USE_SSL === "true" // 預設為 false
  const useStartTLS = options.USE_STARTTLS === "true" // 控制是否使用STARTTLS
  const useSMIME = options.USE_SMIME === "true" // 預設為 false
  const useEncryption = options.USE_ENCRYPTION === "true" // 控制SMIME是否要加密
  const useDKIM = options.USE_DKIM === "true" // 控制是否使用DKIM
  const dirPath = path.join(process.cwd(), "private")

  if (useStartTLS && useSSL) {
    throw new Error(
      "不能同時設置 USE_STARTTLS 或 USE_SSL 為 true。請提供一個合理的配置。"
    )
  }

  const transporterOption = {
    host: options.EMAIL_HOST || "smtp.gmail.com", // 預設使用Gmail
    port: options.EMAIL_PORT || (!useStartTLS && useSSL ? 465 : 587), // 預設使用465
    secure: !useStartTLS && useSSL, // 如果使用 SSL，則 secure 應設為 true；STARTTLS 時設為 false
    auth: {
      user: options.MAIL_AC,
      pass: options.MAIL_PW,
    },
    proxy: options.TRANSPORTS_PROXY,
    connectionTimeout: options.DEBUG_MODE ? 10000 : 120000,
    greetingTimeout: options.DEBUG_MODE ? 5000 : 30000,
    socketTimeout: options.DEBUG_MODE ? 60000 : 600000,
    logger: options.DEBUG_MODE || false,
    debug: options.DEBUG_MODE || false,
    tls: useStartTLS ? { rejectUnauthorized: false } : undefined, // 使用STARTTLS
  }

  const nodemailer = useSMIME ? require("nodemailer4") : require("nodemailer")
  const smime = useSMIME ? require("nodemailer-smime") : null

  if (useDKIM) {
    try {
      if (!fs.existsSync(dirPath)) {
        throw new Error("指定的目錄不存在")
      }

      const dkimKeySelector = options.DKIM_KEY_SELECTOR || "default"
      const dkimDomainName = options.DKIM_DOMAIN_NAME || "example.com"

      const dkimKeyFiles = fs
        .readdirSync(dirPath)
        .filter((file) => path.extname(file) === ".key")

      if (dkimKeyFiles.length === 0) {
        throw new Error("請在private目錄中放置dkim_private.key檔案")
      }

      const dkimPrivateKeyPath = path.join(dirPath, dkimKeyFiles[0])

      transporterOption.dkim = {
        domainName: dkimDomainName,
        keySelector: dkimKeySelector,
        privateKey: fs.readFileSync(dkimPrivateKeyPath, "utf8"),
      }
    } catch (error) {
      console.error("DKIM 設定錯誤:", error)
      throw error
    }
  }

  const transporter = nodemailer.createTransport(transporterOption)

  if (options.TRANSPORTS_PROXY && options.TRANSPORTS_PROXY.trim() !== "") {
    const proxyType = options.TRANSPORTS_PROXY.startsWith("socks5://")
      ? "socks5"
      : "http"
    if (proxyType === "socks5") {
      transporter.set("proxy_socks_module", require("socks"))
    } else {
      const { HttpProxyAgent, HttpsProxyAgent } = require("http-proxy-agent")
      const agent = options.TRANSPORTS_PROXY.startsWith("https")
        ? new HttpsProxyAgent(options.TRANSPORTS_PROXY)
        : new HttpProxyAgent(options.TRANSPORTS_PROXY)
      transporterOption.proxy = agent
    }
  }

  if (useSMIME) {
    try {
      if (!fs.existsSync(dirPath)) {
        throw new Error("指定的目錄不存在")
      }

      const certFiles = fs
        .readdirSync(dirPath)
        .filter((file) => path.extname(file) === ".crt")

      if (certFiles.length === 0) {
        throw new Error("請在private目錄中放置.crt檔案")
      }

      const certPath = path.join(dirPath, certFiles[0])

      const keyFiles = fs
        .readdirSync(dirPath)
        .filter((file) => path.extname(file) === ".key")

      if (keyFiles.length === 0) {
        throw new Error("請在private目錄中放置.key檔案")
      }

      const keyPath = path.join(dirPath, keyFiles[0])

      transporter.use(
        "stream",
        smime({
          cert: fs.readFileSync(certPath, "utf8"),
          key: fs.readFileSync(keyPath, "utf8"),
          encryptionCert: useEncryption
            ? fs.readFileSync(certPath, "utf8")
            : null, // 加密證書，如果需要加密
          signing: {
            signingTime: new Date(),
            from: options.MAIL_AC,
          },
        })
      )
    } catch (error) {
      console.error("SSL/S/MIME 設定錯誤:", error)
      throw error
    }
  }

  try {
    await transporter.sendMail(mailOptions)
    console.log("信件寄送成功！")
  } catch (error) {
    console.error("信件寄送失敗:", error)
    throw error
  }
}

module.exports = sendMail
