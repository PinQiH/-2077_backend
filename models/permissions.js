"use strict"
const { Model } = require("sequelize")
const generateHooks = require("@utils/dateHook")

module.exports = (sequelize, DataTypes) => {
  class Permissions extends Model {
    static associate(models) {
      Permissions.hasMany(models.Role_Permissions, {
        foreignKey: "permission_id",
      })
      Permissions.hasMany(models.Permissions, {
        as: "children", // 別名，使查詢時可以使用 include
        foreignKey: "parent_permission_id", // 指定外鍵
        constraints: false, // 如果不想要外鍵限制，可以設定為 false
      })
    }
  }
  Permissions.init(
    {
      permission_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      parent_permission_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "Permissions",
          key: "permission_id",
        },
      },
      permission_sequence: DataTypes.INTEGER,
      permission_type: DataTypes.TEXT,
      permission_name: DataTypes.TEXT,
      admin_only: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: "Permissions",
      hooks: generateHooks(["createdAt", "updatedAt"]),
    }
  )
  return Permissions
}
