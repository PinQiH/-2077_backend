const db = require("@models")
const { Op } = require("sequelize")
const moment = require("moment-timezone")

module.exports = {
  async getProductDetails(productId, transaction = null) {
    return db.Product.findOne({
      where: { product_id: productId },
      include: [
        {
          model: db.Brand,
        },
      ],
      transaction,
    })
  },
}
