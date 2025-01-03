const axios = require("axios")
const { ThirdPartyApiError } = require("./error")

// 使用自定義代理example
// const myCustomAgent = new http.Agent({
//   keepAlive: true,
//   maxSockets: 100,
// })

// fetchLocalApiData("http://example.com", myCookie, myUserId, {
//   useHttpAgent: true,
//   httpAgent: myCustomAgent, // 使用自定义代理
// })

const defaultOptions = {
  useHttpAgent: false,
  httpAgent: null,
  returnFullResponse: false,
}

function configureAxios(url, cookie, userId, options) {
  const config = {
    headers: {
      ["Content-Type"]: "application/json",
      Cookie: `accessToken=${cookie?.accessToken}`,
      "x-user-id": userId,
    },
    proxy: false,
  }

  if (options.useHttpAgent) {
    // 动态加载 http 或 https 模块
    const protocol = url.startsWith("https") ? "https" : "http"
    const { Agent } = require(protocol)

    // 使用自定义代理
    const customAgent = options.httpAgent || new Agent()

    // 将自定义代理添加到配置中
    config[`${protocol}Agent`] = customAgent
  }

  return config
}

async function fetchLocalApiData(url, cookie, userId, options = {}) {
  try {
    const finalOptions = { ...defaultOptions, ...options }
    const response = await axios.get(
      url,
      configureAxios(url, cookie, userId, finalOptions)
    )

    if (response.status !== 200) {
      throw new ThirdPartyApiError("Local API 抓取失敗")
    }

    return finalOptions.returnFullResponse ? response : response.data
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const serverResponse = err
      throw new ThirdPartyApiError(serverResponse)
    } else {
      throw new ThirdPartyApiError(
        "An unexpected error occurred in fetchLocalApiData: " + err
      )
    }
  }
}

async function sendLocalApiData(url, data, cookie, userId, options = {}) {
  try {
    const finalOptions = { ...defaultOptions, ...options }
    const response = await axios.post(
      url,
      data,
      configureAxios(url, cookie, userId, finalOptions)
    )

    if (response.status !== 200) {
      throw new ThirdPartyApiError("Local API 送出失敗")
    }

    return finalOptions.returnFullResponse ? response : response.data
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const serverResponse = err.response
      throw new ThirdPartyApiError(serverResponse.data.rtnMsg)
    } else {
      throw new ThirdPartyApiError(
        "An unexpected error occurred in sendLocalApiData: " + err.message
      )
    }
  }
}

//putLocalApiData
async function modifiedLocalApiData(url, data, cookie, userId, options = {}) {
  try {
    const finalOptions = { ...defaultOptions, ...options }
    const response = await axios.put(
      url,
      data,
      configureAxios(url, cookie, userId, finalOptions)
    )
    if (response.status !== 200) {
      throw new ThirdPartyApiError("Local API 修改失敗")
    }
    return finalOptions.returnFullResponse ? response : response.data
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const serverResponse = err.response
      throw new ThirdPartyApiError(serverResponse.data.rtnMsg)
    } else {
      throw new ThirdPartyApiError(
        "An unexpected error occurred in modifiedLocalApiData: " + err.message
      )
    }
  }
}

async function deleteLocalApiData(url, cookie, userId, options = {}) {
  try {
    const finalOptions = { ...defaultOptions, ...options }
    const response = await axios.delete(
      url,
      configureAxios(url, cookie, userId, finalOptions)
    )
    if (response.status !== 200) {
      throw new ThirdPartyApiError("Local API 刪除失敗")
    }
    return finalOptions.returnFullResponse ? response : response.data
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const serverResponse = err.response
      throw new ThirdPartyApiError(serverResponse.data.rtnMsg)
    } else {
      throw new ThirdPartyApiError(
        "An unexpected error occurred in deleteLocalApiData: " + err.message
      )
    }
  }
}

module.exports = {
  fetchLocalApiData,
  sendLocalApiData,
  deleteLocalApiData,
  modifiedLocalApiData,
}
