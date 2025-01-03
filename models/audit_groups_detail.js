"use strict"
const { Model } = require("sequelize")
const generateHooks = require("@utils/dateHook")

module.exports = (sequelize, DataTypes) => {
  class Audit_groups_detail extends Model {
    static associate(models) {
      // define association here
      Audit_groups_detail.belongsTo(models.Audit_groups, {
        foreignKey: "audit_group_id",
      })
      Audit_groups_detail.belongsTo(models.Backend_users, {
        foreignKey: "word_manager_user_account",
        as: "wordManager",
      })
    }
  }
  Audit_groups_detail.init(
    {
      audit_group_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
      },
      word_manager_user_account: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "Audit_groups_detail",
      tableName: "Audit_groups_detail",
      hooks: generateHooks(["createdAt", "updatedAt"]),
    }
  )
  return Audit_groups_detail
}
