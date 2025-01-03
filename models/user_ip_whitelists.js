"use strict"
const { Model } = require("sequelize")
const generateHooks = require("@utils/dateHook")

module.exports = (sequelize, DataTypes) => {
  class User_IP_whitelists extends Model {
    static associate(models) {
      User_IP_whitelists.belongsTo(models.Backend_users, {
        foreignKey: "backend_user_account",
      })
      User_IP_whitelists.belongsTo(models.IP_whitelists, {
        foreignKey: "whitelist_id",
      })
    }
  }

  User_IP_whitelists.init(
    {
      backend_user_account: { type: DataTypes.TEXT, primaryKey: true },
      whitelist_id: { type: DataTypes.INTEGER, primaryKey: true },
      creator: DataTypes.TEXT,
      editor: DataTypes.TEXT,
    },
    {
      sequelize,
      modelName: "User_IP_whitelists",
      hooks: generateHooks(["createdAt", "updatedAt"]),
    }
  )

  return User_IP_whitelists
}
