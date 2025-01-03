"use strict"
const fs = require("fs")
require("module-alias/register")
const utilHelper = require("@utils/utilHelper")

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const now = new Date()
    const userProfilesList = JSON.parse(
      fs.readFileSync("./seedData/initSetting.json")
    )["userProfilesList"]

    const userProfilesBulkData = userProfilesList.map((profile) => {
      return {
        user_id: profile.user_id,
        contact_person_name: profile.contact_person_name,
        contact_phone_office: profile.contact_phone_office,
        contact_phone_mobile: profile.contact_phone_mobile,
        contact_department: profile.contact_department,
        contact_position: profile.contact_position,
        contact_email: profile.contact_email,
        createdAt: now,
        updatedAt: now,
      }
    })

    await queryInterface.bulkInsert("UserProfiles", userProfilesBulkData)

    const filePath = "./seedData/userProfilesData.json"
    utilHelper.writeToJSON(filePath, userProfilesBulkData)
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete("UserProfiles", null, {})
  },
}
