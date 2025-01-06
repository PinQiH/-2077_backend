const db = require("@models")
const { Op } = require("sequelize")
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
}
