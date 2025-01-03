"use strict"
const { Model } = require("sequelize")
const generateHooks = require("@utils/dateHook")

module.exports = (sequelize, DataTypes) => {
  class Audit_groups extends Model {
    static associate(models) {
      // define association here
      Audit_groups.hasMany(models.Audit_groups_detail, {
        foreignKey: "audit_group_id",
      })
      Audit_groups.belongsTo(models.Backend_users, {
        foreignKey: "audit_user_account",
        as: "auditUser",
      })
      Audit_groups.belongsTo(models.Backend_users, {
        foreignKey: "agent_user_account",
        as: "agentUser",
      })
    }
  }
  Audit_groups.init(
    {
      audit_group_id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      audit_group_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      audit_user_account: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      agent_user_account: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      creator: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      editor: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "Audit_groups",
      hooks: generateHooks(["createdAt", "updatedAt"]),
    }
  )
  return Audit_groups
}
