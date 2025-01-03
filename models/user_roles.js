"use strict"
const { Model } = require("sequelize")
const generateHooks = require("@utils/dateHook")

module.exports = (sequelize, DataTypes) => {
  class User_Roles extends Model {
    static associate(models) {
      //   define association here
      this.belongsTo(models.Roles, { foreignKey: "role_id" })
      this.belongsTo(models.Backend_users, {
        foreignKey: "backend_user_account",
      })
    }
  }
  User_Roles.init(
    {
      role_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
      },
      backend_user_account: {
        type: DataTypes.TEXT,
        primaryKey: true,
      },
    },
    {
      sequelize,
      modelName: "User_Roles",
      hooks: generateHooks(["createdAt", "updatedAt"]),
    }
  )
  return User_Roles
}
