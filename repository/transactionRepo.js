const db = require("@models")
const { Op } = require("sequelize")
const moment = require("moment-timezone")

module.exports = {
  async calculateProfit() {
    const income = await db.Transaction.sum("amount", {
      where: { type: "IN" },
    })
    const expense = await db.Transaction.sum("amount", {
      where: { type: "OUT" },
    })

    return (income || 0) - (expense || 0)
  },
}
