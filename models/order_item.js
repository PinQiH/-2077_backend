"use strict"
const { Model } = require("sequelize")
const generateHooks = require("@utils/dateHook")

module.exports = (sequelize, DataTypes) => {
  class OrderItem extends Model {
    static associate(models) {
      this.belongsTo(models.Order, { foreignKey: "order_id" })
      this.belongsTo(models.Product, { foreignKey: "product_id" })
    }
  }
  OrderItem.init(
    {
      item_id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      quantity: DataTypes.INTEGER,
      cost_price: DataTypes.DECIMAL,
      price: DataTypes.DECIMAL,
      subtotal: DataTypes.DECIMAL,
    },
    {
      sequelize,
      modelName: "OrderItem",
      tableName: "order_items",
      hooks: generateHooks(["createdAt", "updatedAt"]),
    }
  )
  return OrderItem
}
