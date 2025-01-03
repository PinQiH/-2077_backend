const { Op } = require("sequelize")

const adjustDateForUTC8 = (date) => {
  if (date instanceof Date) {
    return new Date(date.getTime() - 8 * 60 * 60 * 1000)
  }
  return date
}

const recurseAndAdjustDate = (queryObj, targetFields) => {
  for (let key in queryObj) {
    if (targetFields.includes(key)) {
      if (queryObj[key] instanceof Date) {
        queryObj[key] = adjustDateForUTC8(queryObj[key])
      } else if (queryObj[key][Op.in] || queryObj[key][Op.between]) {
        const opKey = queryObj[key][Op.in] ? Op.in : Op.between
        queryObj[key][opKey] = queryObj[key][opKey].map(adjustDateForUTC8)
      } else {
        for (let subKey in queryObj[key]) {
          if (queryObj[key][subKey] instanceof Date) {
            queryObj[key][subKey] = adjustDateForUTC8(queryObj[key][subKey])
          }
        }
      }
    } else if (typeof queryObj[key] === "object") {
      recurseAndAdjustDate(queryObj[key], targetFields)
    }
  }
}

const generateHooks = (fields) => {
  return {
    beforeFind: (options) => {
      if (options.where) {
        recurseAndAdjustDate(options.where, fields)
      }
    },
    afterFind: (result) => {
      if (Array.isArray(result)) {
        result.forEach((row) => {
          fields.forEach((field) => {
            if (row[field]) {
              row[field] = new Date(row[field].getTime() + 8 * 60 * 60 * 1000)
            }
          })
        })
      } else {
        fields.forEach((field) => {
          if (result && result[field]) {
            result[field] = new Date(
              result[field].getTime() + 8 * 60 * 60 * 1000
            )
          }
        })
      }
    },
  }
}

module.exports = generateHooks
