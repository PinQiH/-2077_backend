"use strict"
const fs = require("fs")
require("module-alias/register")
const utilHelper = require("@utils/utilHelper")

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const now = new Date()
    const RolePermissionsList = JSON.parse(
      fs.readFileSync("./seedData/initSetting.json")
    )["RolePermissionsList"]

    const RolePermissionsBulkData = RolePermissionsList.map(
      (RolePermission) => {
        return {
          role_id: RolePermission.role_id,
          permission_id: RolePermission.permission_id,
          createdAt: now,
          updatedAt: now,
        }
      }
    )

    await queryInterface.bulkInsert("Role_Permissions", RolePermissionsBulkData)

    const filePath = "./seedData/rolePermissionsData.json"
    utilHelper.writeToJSON(filePath, RolePermissionsBulkData)
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete("Role_Permissions", null, {})
  },
}
