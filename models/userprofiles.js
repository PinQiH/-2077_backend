"use strict"
const { Model } = require("sequelize")
const generateHooks = require("@utils/dateHook")

module.exports = (sequelize, DataTypes) => {
  class UserProfiles extends Model {
    static associate(models) {
      UserProfiles.belongsTo(models.Frontend_users, {
        foreignKey: "user_id",
      })
    }
  }
  UserProfiles.init(
    {
      profile_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Frontend_users",
          key: "user_id",
        },
      },
      contact_person_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      contact_phone_office: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      contact_phone_mobile: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      contact_department: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      contact_position: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      contact_email: {
        type: DataTypes.STRING(254),
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "UserProfiles",
      hooks: generateHooks(["createdAt", "updatedAt"]),
    }
  )
  return UserProfiles
}
