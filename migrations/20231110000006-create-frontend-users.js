"use strict"

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Frontend_users", {
      user_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      username: {
        type: Sequelize.STRING(50),
        unique: true, // @需要嗎
        allowNull: false, // @需要嗎
      },
      email: {
        type: Sequelize.TEXT,
        unique: true, // @需要嗎
        allowNull: false, // @需要嗎
      },
      password_hash: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      account_status: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0, // Assuming 'active' as the default status
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
    await queryInterface.dropTable("Frontend_users")
  },
}
