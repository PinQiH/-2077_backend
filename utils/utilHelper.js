module.exports = {
  offsetTime: (time) => {
    const dateOffset = 8 * 60 * 60 * 1000
    return new Date(time.getTime() + dateOffset)
  },
  getLaterDate: (nowDate, delay, type) => {
    const multipliers = {
      month: 30 * 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      hour: 60 * 60 * 1000,
      minute: 60 * 1000,
      second: 1000,
    }
    const multiplier = multipliers[type] || multipliers.day
    const expiresInMilliseconds = delay * multiplier
    return new Date(nowDate.getTime() + expiresInMilliseconds)
  },
  getImageBase64: async (imagePath) => {
    const fs = require("fs")
    const util = require("util")
    const path = require("path")
    const readFile = util.promisify(fs.readFile)
    try {
      if (!imagePath) {
        return ""
      }
      const buffer = await readFile(imagePath, { encoding: "base64" })
      const ext = path.extname(imagePath)
      return `data:image/${ext};base64,${buffer}`
    } catch (err) {
      throw err
    }
  },
  errorResponse: async (
    res,
    rtnCode,
    rtnMsg,
    rollbackFunction,
    data = null
  ) => {
    try {
      if (rollbackFunction) {
        await rollbackFunction()
      }
    } catch (err) {
      throw err
    }
    res.status(200).json({ rtnCode, rtnMsg, data })
  },
  snakeToCamel: function (obj) {
    const convertKey = (key) => {
      return key
        .replace(/([-_][a-zA-Z])/g, (group) => group.charAt(1).toUpperCase())
        .replace(/^[A-Z]/, (match) => match.toLowerCase())
    }
    if (Array.isArray(obj)) {
      return obj.map(this.snakeToCamel, this)
    } else if (obj !== null && obj.constructor === Object) {
      return Object.fromEntries(
        Object.entries(obj).map(([key, value]) => [
          convertKey(key),
          this.snakeToCamel(value),
        ])
      )
    }
    return obj
  },
  camelToSnake: function (obj) {
    if (Array.isArray(obj)) {
      return obj.map((item) => this.camelToSnake(item))
    } else if (obj !== null && obj.constructor === Object) {
      return Object.fromEntries(
        Object.entries(obj).map(([key, value]) => [
          key.replace(/([A-Z])/g, (group) => `_${group.toLowerCase()}`),
          this.camelToSnake(value),
        ])
      )
    }
    return obj
  },
  trimAllSpace: (str) => {
    return str.replace(/\s/g, "")
  },
  flattenObject: function (data) {
    let flattenedData = { ...data }

    for (let key in flattenedData) {
      if (
        typeof flattenedData[key] === "object" &&
        !(flattenedData[key] instanceof Date) &&
        flattenedData[key] !== null
      ) {
        const nestedObject = flattenedData[key]
        delete flattenedData[key]
        flattenedData = {
          ...flattenedData,
          ...this.flattenObject(nestedObject),
        }
      }
    }

    return flattenedData
  },
  formatQueryData: function (queryData) {
    const dataJson = queryData.toJSON()
    const dataCamel = this.snakeToCamel(dataJson)
    return this.flattenObject(dataCamel)
  },
  formatQueryAllData: function (queryData) {
    return queryData.map((data) => {
      const dataJson = data.toJSON()
      const dataCamel = this.snakeToCamel(dataJson)
      return this.flattenObject(dataCamel)
    })
  },
  getCleanedIP: (ip) => {
    if (ip.startsWith("::ffff:")) {
      return ip.substr(7)
    }
    return ip
  },
  writeToJSON: (filePath, data) => {
    const fs = require("fs")
    try {
      const dataJSON = JSON.stringify(data, null, 2)
      fs.writeFileSync(filePath, dataJSON, { flag: "w" })
    } catch (err) {
      throw err
    }
  },
  bypassQueryCheckIfAdmin: (roles, originalWhereObject) => {
    const isAdmin = roles.some((role) => role.roleName === "admin")
    const { user_id, creator_id, ...newWhereObject } = originalWhereObject
    return isAdmin ? newWhereObject : originalWhereObject
  },
  validateRequestBody: (req, requiredAttributes) => {
    const missingAttributes = []

    // 檢查每個必須的屬性
    for (const attribute of requiredAttributes) {
      if (!(attribute in req.body)) {
        missingAttributes.push(attribute)
      }
    }

    // 如果有缺少的屬性，返回一個包含錯誤消息的物件
    if (missingAttributes.length > 0) {
      return {
        isValid: false,
        errorMessage: `缺少必須的屬性: ${missingAttributes.join(", ")}`,
      }
    }

    // 如果所有屬性都存在，返回一個驗證成功的物件
    return {
      isValid: true,
      errorMessage: "",
    }
  },
}
