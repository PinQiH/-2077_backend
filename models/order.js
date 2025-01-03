"use strict"
const { Model } = require("sequelize")
const generateHooks = require("@utils/dateHook")

module.exports = (sequelize, DataTypes) => {
  class Order extends Model {
    static associate(models) {
      this.hasMany(models.OrderItem, { foreignKey: "order_id" })
      this.hasMany(models.Transaction, { foreignKey: "order_id" })
    }
  }
  Order.init(
    {
      order_id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      order_date: DataTypes.DATE,
      total: DataTypes.DECIMAL,
      status: DataTypes.STRING,
      notes: DataTypes.TEXT,
    },
    {
      sequelize,
      modelName: "Order",
      tableName: "orders",
      hooks: generateHooks(["createdAt", "updatedAt"]),
    }
  )
  return Order
}
