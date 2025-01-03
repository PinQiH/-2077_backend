"use strict"
const fs = require("fs")
require("module-alias/register")
const utilHelper = require("@utils/utilHelper")

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const now = new Date()
    const rolesList = JSON.parse(
      fs.readFileSync("./seedData/initSetting.json")
    )["rolesList"]

    const rolesBulkData = rolesList.map((role) => {
      return {
        role_name: role.role_name,
        role_status: 0,
        createdAt: now,
        updatedAt: now,
      }
    })

    await queryInterface.bulkInsert("Roles", rolesBulkData)

    const filePath = "./seedData/rolesData.json"
    utilHelper.writeToJSON(filePath, rolesBulkData)
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete("Roles", null, {})
  },
}
