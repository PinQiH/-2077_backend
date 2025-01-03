const db = require("@models")
const {
  ValidationError,
  DatabaseConflictError,
  PermissionError,
  ThirdPartyApiError,
} = require("@utils/error")
const { snakeToCamel, getLaterDate } = require("@utils/utilHelper")
const { Op } = require("sequelize")

module.exports = {
  async getSetting(name) {
    try {
      const setting = await db.Settings.findOne({
        where: {
          setting_name: name,
        },
      })

      if (setting) {
        return setting.setting_value
      } else {
        throw new Error("Setting not found")
      }
    } catch (error) {
      throw error
    }
  },
}
