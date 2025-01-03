"use strict"

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("UserProfiles", {
      profile_id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Frontend_users",
          key: "user_id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      contact_person_name: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      contact_phone_office: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      contact_phone_mobile: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      contact_department: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      contact_position: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      contact_email: {
        type: Sequelize.STRING(254),
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("UserProfiles")
  },
}
