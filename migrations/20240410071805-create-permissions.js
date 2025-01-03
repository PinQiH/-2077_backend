"use strict"
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Permissions", {
      permission_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      parent_permission_id: {
        type: Sequelize.INTEGER,
        references: {
          model: "Permissions",
          key: "permission_id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      permission_sequence: {
        type: Sequelize.INTEGER,
      },
      permission_type: {
        type: Sequelize.TEXT,
      },
      permission_name: {
        type: Sequelize.TEXT,
      },
      admin_only: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
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
    await queryInterface.dropTable("Permissions")
  },
}
