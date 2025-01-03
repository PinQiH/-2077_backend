"use strict"
const fs = require("fs")
require("module-alias/register")
const utilHelper = require("@utils/utilHelper")

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const now = new Date()
    const userIPWhitelists = JSON.parse(
      fs.readFileSync("./seedData/initSetting.json")
    )["userIPWhitelists"]

    const userIPWhiteBulkData = userIPWhitelists.map((userIPWhite) => {
      return {
        backend_user_account: userIPWhite.backend_user_account,
        whitelist_id: userIPWhite.whitelist_id,
        creator: userIPWhite.creator,
        editor: userIPWhite.editor,
        createdAt: now,
        updatedAt: now,
      }
    })
    await queryInterface.bulkInsert("User_IP_whitelists", userIPWhiteBulkData)

    const filePath = "./seedData/userIPWhiteData.json"
    utilHelper.writeToJSON(filePath, userIPWhiteBulkData)
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete("User_IP_whitelists", null, {})
  },
}
