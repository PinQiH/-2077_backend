// Seeder for AuditGroupDetail
"use strict"
const fs = require("fs")
require("module-alias/register")
const utilHelper = require("@utils/utilHelper")

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      const now = new Date()
      const initData = JSON.parse(
        fs.readFileSync("./seedData/initSetting.json")
      )

      const auditGroupDetailsData = initData["AuditGroupDetails"].map(
        (detail) => {
          return {
            audit_group_id: detail.audit_group_id,
            word_manager_user_account: detail.word_manager_user_account,
            createdAt: detail.createdAt || now,
            updatedAt: detail.updatedAt || now,
          }
        }
      )

      await queryInterface.bulkInsert(
        "Audit_groups_detail",
        auditGroupDetailsData
      )

      const filePath = "./seedData/auditGroupDetailsData.json"
      utilHelper.writeToJSON(filePath, auditGroupDetailsData)
    } catch (err) {
      console.log(err)
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete("Audit_groups_detail", null, {})
  },
}
