"use strict"

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.renameColumn("transactions", "id", "transaction_id")
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.renameColumn("transactions", "transaction_id", "id")
  },
}
