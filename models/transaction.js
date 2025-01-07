"use strict"
const { Model } = require("sequelize")
const generateHooks = require("@utils/dateHook")

module.exports = (sequelize, DataTypes) => {
  class Transaction extends Model {
    static associate(models) {
      this.belongsTo(models.Order, { foreignKey: "order_id" })
    }
  }
  Transaction.init(
    {
      transaction_id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      amount: DataTypes.DECIMAL,
      type: {
        type: DataTypes.ENUM("IN", "OUT"),
      },
      profit: DataTypes.DECIMAL,
      description: DataTypes.TEXT,
    },
    {
      sequelize,
      modelName: "Transaction",
      tableName: "transactions",
      hooks: generateHooks(["createdAt", "updatedAt"]),
    }
  )
  return Transaction
}
