"use strict"

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Backend_users", {
      backend_user_account: {
        type: Sequelize.TEXT,
        primaryKey: true,
      },
      account_status: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0, // Assuming 'active' as the default status
      },
      email: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      password: {
        type: Sequelize.TEXT,
        allowNull: false,
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
    await queryInterface.dropTable("Backend_users")
  },
}
