"use strict"
const fs = require("fs")
require("module-alias/register")
const utilHelper = require("@utils/utilHelper")

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const now = new Date()
    const ipWhitelists = JSON.parse(
      fs.readFileSync("./seedData/initSetting.json")
    )["ipWhitelists"]

    const ipWhitelistsBulkData = ipWhitelists.map((ipWhite) => {
      return {
        name: ipWhite.name,
        single_ip: ipWhite.single_ip,
        ip_start: ipWhite.ip_start,
        ip_end: ipWhite.ip_end,
        ip_status: ipWhite.ip_status,
        creator: ipWhite.creator,
        editor: ipWhite.editor,
        createdAt: now,
        updatedAt: now,
      }
    })

    await queryInterface.bulkInsert("IP_whitelists", ipWhitelistsBulkData)

    const filePath = "./seedData/ipWhitelistsData.json"
    utilHelper.writeToJSON(filePath, ipWhitelistsBulkData)
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete("IP_whitelists", null, {})
  },
}
