"use strict"
const fs = require("fs")
require("module-alias/register")
const utilHelper = require("@utils/utilHelper")

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const now = new Date()
    const UserRolesList = JSON.parse(
      fs.readFileSync("./seedData/initSetting.json")
    )["UserRolesList"]

    const UserRolesBulkData = UserRolesList.map((UserRoles) => {
      return {
        role_id: UserRoles.role_id,
        backend_user_account: UserRoles.backend_user_account,
        createdAt: now,
        updatedAt: now,
      }
    })

    await queryInterface.bulkInsert("User_Roles", UserRolesBulkData)

    const filePath = "./seedData/userRolesData.json"
    utilHelper.writeToJSON(filePath, UserRolesBulkData)
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete("User_Roles", null, {})
  },
}
