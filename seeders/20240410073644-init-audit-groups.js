// Seeder for AuditGroup
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

      const auditGroupsData = initData["AuditGroups"].map((group) => {
        return {
          audit_group_name: group.audit_group_name,
          audit_user_account: group.audit_user_account,
          agent_user_account: group.agent_user_account || null,
          creator: group.creator || "system",
          editor: group.editor || "system",
          createdAt: group.createdAt || now,
          updatedAt: group.updatedAt || now,
        }
      })

      await queryInterface.bulkInsert("Audit_groups", auditGroupsData)

      const filePath = "./seedData/auditGroupsData.json"
      utilHelper.writeToJSON(filePath, auditGroupsData)
    } catch (err) {
      console.log(err)
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete("Audit_groups", null, {})
  },
}
