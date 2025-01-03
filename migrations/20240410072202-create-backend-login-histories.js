"use strict"

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Backend_login_histories", {
      login_history_id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      backend_user_account: {
        type: Sequelize.TEXT,
        references: {
          model: "Backend_users",
          key: "backend_user_account",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      ip_address: {
        type: Sequelize.TEXT,
      },
      login_status: {
        type: Sequelize.INTEGER,
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
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("Backend_login_histories")
  },
}
