"use strict"

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("orders", "order_by", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "Frontend_users",
        key: "user_id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("orders", "ordered_by")
  },
}
