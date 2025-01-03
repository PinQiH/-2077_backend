"use strict"

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("IP_whitelists", {
      whitelist_id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      name: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      single_ip: {
        type: Sequelize.TEXT,
      },
      ip_start: {
        type: Sequelize.TEXT,
      },
      ip_end: {
        type: Sequelize.TEXT,
      },
      ip_status: {
        type: Sequelize.INTEGER,
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
    await queryInterface.dropTable("IP_whitelists")
  },
}
