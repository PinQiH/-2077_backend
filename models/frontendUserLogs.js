"use strict"
const { Model } = require("sequelize")
const generateHooks = require("@utils/dateHook") // 根據您的系統設置引用自定義 hooks

module.exports = (sequelize, DataTypes) => {
  class FrontendUserLogs extends Model {
    static associate(models) {
      // 定義與 Frontend_users 的關聯
      FrontendUserLogs.belongsTo(models.Frontend_users, {
        foreignKey: "user_id",
      })
      // 定義與 Backend_users 的關聯
      FrontendUserLogs.belongsTo(models.Backend_users, {
        foreignKey: "editor",
      })
    }
  }

  FrontendUserLogs.init(
    {
      frontend_user_log_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      action_type: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      changes: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      editor: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "FrontendUserLogs",
      tableName: "FrontendUserLogs",
      hooks: generateHooks(["createdAt", "updatedAt"]),
    }
  )

  return FrontendUserLogs
}
