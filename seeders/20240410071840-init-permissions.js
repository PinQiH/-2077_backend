"use strict"
const fs = require("fs")
require("module-alias/register")
const utilHelper = require("@utils/utilHelper")

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const now = new Date()
    const permissionsList = JSON.parse(
      fs.readFileSync("./seedData/initSetting.json")
    )["permissionsList"]

    const permissionsBulkData = permissionsList.map((permission) => {
      return {
        permission_id: permission.permission_id,
        parent_permission_id: permission.parent_permission_id,
        permission_sequence: permission.permission_sequence,
        permission_type: permission.permission_type,
        permission_name: permission.permission_name,
        admin_only: permission.admin_only,
        createdAt: now,
        updatedAt: now,
      }
    })

    await queryInterface.bulkInsert("Permissions", permissionsBulkData)

    const filePath = "./seedData/permissionsData.json"
    utilHelper.writeToJSON(filePath, permissionsBulkData)
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete("Permissions", null, {})
  },
}
