"use strict"

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("Frontend_users", "deletedAt", {
      type: Sequelize.DATE,
      allowNull: true, // deletedAt 為 null 時表示未被刪除
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("Frontend_users", "deletedAt")
  },
}
