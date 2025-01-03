"use strict"
const { Model } = require("sequelize")
const generateHooks = require("@utils/dateHook")

module.exports = (sequelize, DataTypes) => {
  class IP_whitelists extends Model {
    static associate(models) {
      IP_whitelists.hasMany(models.User_IP_whitelists, {
        foreignKey: "whitelist_id",
      })
    }
  }
  IP_whitelists.init(
    {
      whitelist_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: DataTypes.TEXT,
      single_ip: DataTypes.TEXT,
      ip_start: DataTypes.TEXT,
      ip_end: DataTypes.TEXT,
      ip_status: DataTypes.INTEGER,
      creator: DataTypes.TEXT,
      editor: DataTypes.TEXT,
    },
    {
      sequelize,
      modelName: "IP_whitelists",
      hooks: generateHooks(["createdAt", "updatedAt"]),
    }
  )
  return IP_whitelists
}
