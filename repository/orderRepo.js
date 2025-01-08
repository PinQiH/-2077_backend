const db = require("@models")
const { Op, Sequelize } = require("sequelize")
const moment = require("moment-timezone")

module.exports = {
  async getOrderDetails(orderId, transaction = null) {
    return db.Order.findOne({
      where: { order_id: orderId },
      include: [
        {
          model: db.Frontend_users,
        },
        {
          model: db.OrderItem,
          include: [{ model: db.Product }],
        },
      ],
      transaction,
    })
  },

  async getMonthlyOrderReport(year) {
    try {
      const results = await db.Order.findAll({
        attributes: [
          [Sequelize.literal("DATE_PART('month', \"order_date\")"), "month"],
          [Sequelize.fn("SUM", Sequelize.col("total")), "totalSales"],
        ],
        where: {
          order_date: {
            [Op.between]: [`${year}-01-01`, `${year}-12-31`],
          },
          status: {
            [Op.ne]: "取消", // 排除狀態為 "取消"
          },
        },
        group: [Sequelize.literal("DATE_PART('month', \"order_date\")")],
        order: [
          [Sequelize.literal("DATE_PART('month', \"order_date\")"), "ASC"],
        ],
      })

      // 格式化結果，確保返回 12 個月的數據
      const monthlyData = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        totalSales: 0,
      }))

      results.forEach((result) => {
        const month = result.dataValues.month
        const totalSales = parseFloat(result.dataValues.totalSales)
        monthlyData[month - 1].totalSales = totalSales
      })

      return monthlyData
    } catch (error) {
      console.error("Repository - getMonthlyOrderReport error:", error)
      throw error
    }
  },
}
