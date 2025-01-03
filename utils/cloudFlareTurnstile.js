const FormData = require("form-data")
const fetch = require("node-fetch")
const { SocksProxyAgent } = require("socks-proxy-agent")

async function cfCheck(token, ip, options = {}) {
  if (!options.CFKEY) {
    throw new Error("Cloudflare Turnstile secret key is missing")
  }

  const config = {
    TRANSPORTS_PROXY: options.TRANSPORTS_PROXY || null,
    CFKEY: options.CFKEY,
  }

  try {
    const agent = config.TRANSPORTS_PROXY
      ? new SocksProxyAgent(config.TRANSPORTS_PROXY)
      : null

    const formData = new FormData()
    formData.append("secret", config.CFKEY)
    formData.append("response", token)
    formData.append("remoteip", ip)

    const url = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
    const result = await fetch(url, {
      body: formData,
      method: "POST",
      agent,
    })

    const outcome = await result.json()
    return outcome.success
  } catch (err) {
    console.error("Error in cfCheck:", err)
    throw err
  }
}

module.exports = cfCheck
