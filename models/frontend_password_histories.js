"use strict"
const { Model } = require("sequelize")
const generateHooks = require("@utils/dateHook")

module.exports = (sequelize, DataTypes) => {
  class Frontend_password_histories extends Model {
    static associate(models) {
      // 定義與Frontend_users的關聯
      Frontend_password_histories.belongsTo(models.Frontend_users, {
        foreignKey: "user_id",
      })
    }
  }

  Frontend_password_histories.init(
    {
      password_history_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "Frontend_password_histories",
      hooks: generateHooks(["createdAt", "updatedAt"]),
    }
  )

  return Frontend_password_histories
}
