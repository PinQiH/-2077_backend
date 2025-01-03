"use strict"
const { Model } = require("sequelize")
const generateHooks = require("@utils/dateHook")

module.exports = (sequelize, DataTypes) => {
  class Backend_login_histories extends Model {
    static associate(models) {
      Backend_login_histories.belongsTo(models.Backend_users, {
        foreignKey: "backend_user_account",
      })
    }
  }
  Backend_login_histories.init(
    {
      login_history_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      backend_user_account: DataTypes.TEXT,
      ip_address: DataTypes.TEXT,
      login_status: DataTypes.INTEGER,
      createdAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: "Backend_login_histories",
      hooks: generateHooks(["createdAt", "updatedAt"]),
    }
  )
  return Backend_login_histories
}
