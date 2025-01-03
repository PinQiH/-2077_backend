"use strict"

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("User_IP_whitelists", {
      backend_user_account: {
        type: Sequelize.TEXT,
        references: {
          model: "Backend_users",
          key: "backend_user_account",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      whitelist_id: {
        type: Sequelize.INTEGER,
        references: {
          model: "IP_whitelists",
          key: "whitelist_id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      creator: {
        type: Sequelize.TEXT,
      },
      editor: {
        type: Sequelize.TEXT,
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
    await queryInterface.dropTable("User_IP_whitelists")
  },
}
