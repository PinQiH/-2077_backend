"use strict"
const fs = require("fs")
require("module-alias/register")
const utilHelper = require("@utils/utilHelper")

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      const now = new Date()
      const settingList = JSON.parse(
        fs.readFileSync("./seedData/initSetting.json")
      )["settingList"]

      const setDataPromises = settingList.map(async (set) => {
        return {
          setting_name: set.setting_name,
          setting_value: set.setting_value || "N",
          createdAt: now,
          updatedAt: now,
        }
      })

      const setData = await Promise.all(setDataPromises)

      await queryInterface.bulkInsert("Settings", setData)

      const filePath = "./seedData/UsersData.json"
      utilHelper.writeToJSON(filePath, setData)
    } catch (err) {
      console.log(err)
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("Settings", null, {})
  },
}
