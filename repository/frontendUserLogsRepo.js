const db = require("@models")
const { Op } = require("sequelize")

module.exports = {
  async createFrontendUserLog(data, transaction = null) {
    return await db.FrontendUserLogs.create(data, { transaction })
  },

  async findAllFrontendUserLogs(query = {}, transaction = null) {
    return await db.FrontendUserLogs.findAll({
      where: query,
      transaction,
    })
  },

  async findFrontendUserLogById(id, transaction = null) {
    return await db.FrontendUserLogs.findOne({
      where: { log_id: id },
      transaction,
    })
  },

  async updateFrontendUserLog(id, data, transaction = null) {
    return await db.FrontendUserLogs.update(data, {
      where: { log_id: id },
      transaction,
    })
  },

  async deleteFrontendUserLog(id, transaction = null) {
    return await db.FrontendUserLogs.destroy({
      where: { log_id: id },
      transaction,
    })
  },
}
