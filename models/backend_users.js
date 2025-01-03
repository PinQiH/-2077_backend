"use strict"
const { Model } = require("sequelize")
const generateHooks = require("@utils/dateHook")

module.exports = (sequelize, DataTypes) => {
  class Backend_users extends Model {
    static associate(models) {
      this.hasMany(models.Backend_login_histories, {
        foreignKey: "backend_user_account",
        as: "loginHistories",
      })
      this.hasMany(models.User_IP_whitelists, {
        foreignKey: "backend_user_account",
        as: "ipWhitelists",
      })
      this.hasMany(models.User_Roles, {
        foreignKey: "backend_user_account",
      })
    }
  }

  Backend_users.init(
    {
      backend_user_account: {
        type: DataTypes.TEXT,
        primaryKey: true,
        allowNull: false,
      },
      account_status: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      email: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      password: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      creator: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      editor: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "Backend_users",
      hooks: generateHooks(["createdAt", "updatedAt"]),
    }
  )

  return Backend_users
}
