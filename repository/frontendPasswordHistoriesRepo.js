"use strict"

const { Op } = require("sequelize")
const db = require("@models")

module.exports = {
  async findPasswordHistoriesByUserId(userId, transaction = null) {
    return await db.Frontend_password_histories.findAll({
      where: { user_id: userId },
      order: [["date", "DESC"]], // 根據日期倒序排列
      transaction,
    })
  },

  async createPasswordHistory(passwordHistoryData, transaction = null) {
    return await db.Frontend_password_histories.create(passwordHistoryData, {
      transaction,
    })
  },

  async findPasswordHistoryById(passwordHistoryId, transaction = null) {
    return await db.Frontend_password_histories.findOne({
      where: { password_history_id: passwordHistoryId },
      transaction,
    })
  },

  async deletePasswordHistory(passwordHistoryId, transaction = null) {
    return await db.Frontend_password_histories.destroy({
      where: { password_history_id: passwordHistoryId },
      transaction,
    })
  },

  async updatePasswordHistory(
    passwordHistoryId,
    updateData,
    transaction = null
  ) {
    return await db.Frontend_password_histories.update(updateData, {
      where: { password_history_id: passwordHistoryId },
      transaction,
    })
  },
}
