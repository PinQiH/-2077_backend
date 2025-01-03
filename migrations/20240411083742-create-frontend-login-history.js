"use strict"
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Frontend_login_histories", {
      login_history_id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      username: {
        allowNull: true,
        type: Sequelize.TEXT,
      },
      email: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      login_status: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    })

    // 添加欄位的註釋
    await queryInterface.sequelize.query(`
      COMMENT ON COLUMN "Frontend_login_histories"."login_status" IS '0: success, 1: failure'
    `)
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("Frontend_login_histories")
  },
}
