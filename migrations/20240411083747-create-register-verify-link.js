"use strict"
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Register_verify_links", {
      email_verify_link_id: {
        autoIncrement: true,
        allowNull: false,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      username: {
        allowNull: true,
        type: Sequelize.TEXT,
      },
      email: {
        allowNull: true,
        type: Sequelize.TEXT,
      },
      verify_token: {
        allowNull: false,
        type: Sequelize.UUID,
      },
      token_status: {
        allowNull: false,
        type: Sequelize.INTEGER,
      },
      expire_at: {
        allowNull: false,
        type: Sequelize.DATE,
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
      COMMENT ON COLUMN "Register_verify_links"."token_status" IS '0:active, 1: verified, 2: invalid'
    `)
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("Register_verify_links")
  },
}
