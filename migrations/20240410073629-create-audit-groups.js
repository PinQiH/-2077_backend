// migration for AuditGroup
"use strict"

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Audit_groups", {
      audit_group_id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      audit_group_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      audit_user_account: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: "Backend_users",
          key: "backend_user_account",
        },
      },
      agent_user_account: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      creator: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      editor: {
        type: Sequelize.STRING,
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
    await queryInterface.dropTable("Audit_groups")
  },
}
