"use strict"
const { Model } = require("sequelize")
module.exports = (sequelize, DataTypes) => {
  class RegisterVerifyLink extends Model {
    static associate(models) {
      this.belongsTo(models.Frontend_users, {
        foreignKey: "email",
      })
      this.belongsTo(models.Frontend_users, {
        foreignKey: "username",
      })
    }
  }
  RegisterVerifyLink.init(
    {
      email_verify_link_id: {
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
      verify_token: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      token_status: {
        type: DataTypes.INTEGER, // 0:active, 1: verified, 2: invalid
        allowNull: false,
      },
      expire_at: { type: DataTypes.DATE, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false },
    },
    {
      sequelize,
      modelName: "RegisterVerifyLink",
      tableName: "Register_verify_links",
    }
  )
  return RegisterVerifyLink
}
