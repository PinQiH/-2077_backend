"use strict"
const { Model } = require("sequelize")
const generateHooks = require("@utils/dateHook")

module.exports = (sequelize, DataTypes) => {
  class Roles extends Model {
    static associate(models) {
      Roles.hasMany(models.Role_Permissions, {
        foreignKey: "role_id",
      })
      Roles.hasMany(models.User_Roles, {
        foreignKey: "role_id",
      })
    }
  }
  Roles.init(
    {
      role_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      role_name: {
        type: DataTypes.TEXT,
        allowNull: false,
        unique: true,
      },
      role_status: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      creator: {
        type: DataTypes.TEXT,
        allowNull: true, // Assuming nullable based on your schema
      },
      editor: {
        type: DataTypes.TEXT,
        allowNull: true, // Assuming nullable based on your schema
      },
    },
    {
      sequelize,
      modelName: "Roles",
      hooks: generateHooks(["createdAt", "updatedAt"]),
    }
  )
  return Roles
}
