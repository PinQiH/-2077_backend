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
      order_by: DataTypes.INTEGER,
      order_date: DataTypes.DATE,
      total: DataTypes.DECIMAL,
      status: {
        type: DataTypes.ENUM(
          "待處理",
          "連線中",
          "準備出貨",
          "已出貨",
          "完成",
          "取消"
        ),
        allowNull: false, // 確保不能為 NULL
        defaultValue: "待處理", // 設定預設值
      },
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
