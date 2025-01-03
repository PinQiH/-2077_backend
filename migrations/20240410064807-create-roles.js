"use strict"

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Roles", {
      role_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      role_name: {
        type: Sequelize.TEXT,
        allowNull: false,
        unique: true,
      },
      role_status: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      creator: {
        type: Sequelize.TEXT,
        allowNull: true, // Assuming nullable based on your schema
      },
      editor: {
        type: Sequelize.TEXT,
        allowNull: true, // Assuming nullable based on your schema
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
    await queryInterface.dropTable("Roles")
  },
}
