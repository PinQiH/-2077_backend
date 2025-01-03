"use strict"
const { Model } = require("sequelize")
module.exports = (sequelize, DataTypes) => {
  class FrontendLoginHistory extends Model {
    static associate(models) {
      this.belongsTo(models.Frontend_users, {
        foreignKey: "email",
      })
    }
  }
  FrontendLoginHistory.init(
    {
      login_history_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      username: {
        allowNull: true,
        type: DataTypes.TEXT,
      },
      email: {
        allowNull: true,
        type: DataTypes.TEXT,
      },
      login_status: {
        type: DataTypes.INTEGER,
        allowNull: false,
      }, // 0: success, 1: failure
      createdAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: "FrontendLoginHistory",
      tableName: "Frontend_login_histories",
    }
  )
  return FrontendLoginHistory
}
