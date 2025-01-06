"use strict"
const { Model } = require("sequelize")
const generateHooks = require("@utils/dateHook")

module.exports = (sequelize, DataTypes) => {
  class Frontend_users extends Model {
    static associate(models) {
      this.hasMany(models.Order, { foreignKey: "order_by" })
    }
  }

  Frontend_users.init(
    {
      user_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      username: {
        type: DataTypes.STRING(50),
        unique: true,
        allowNull: false,
      },
      email: {
        type: DataTypes.TEXT,
        unique: true,
        allowNull: false,
      },
      password_hash: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      account_status: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0, // 0 代表 active, 1 代表 forbit
      },
    },
    {
      sequelize,
      modelName: "Frontend_users",
      tableName: "Frontend_users",
      hooks: generateHooks(["createdAt", "updatedAt"]),
    }
  )

  return Frontend_users
}
