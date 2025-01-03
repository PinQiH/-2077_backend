"use strict"
const { Model } = require("sequelize")
const generateHooks = require("@utils/dateHook")

module.exports = (sequelize, DataTypes) => {
  class Role_Permissions extends Model {
    static associate(models) {
      Role_Permissions.belongsTo(models.Permissions, {
        foreignKey: "permission_id",
      })
      Role_Permissions.belongsTo(models.Roles, {
        foreignKey: "role_id",
      })
    }
  }
  Role_Permissions.init(
    {
      role_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
      },
      permission_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
      },
    },
    {
      sequelize,
      modelName: "Role_Permissions",
      hooks: generateHooks(["createdAt", "updatedAt"]),
    }
  )
  return Role_Permissions
}
