"use strict"
const crypto = require("crypto")
const fs = require("fs")
require("module-alias/register")
const utilHelper = require("@utils/utilHelper")
const bcrypt = require("bcrypt")

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      const now = new Date()
      const backendUsersList = JSON.parse(
        fs.readFileSync("./seedData/initSetting.json")
      )["backendUsersList"]
      const salt = await bcrypt.genSalt(10)

      const backendUsersDataPromises = backendUsersList.map(async (user) => {
        const hashedPassword = await bcrypt.hash(user.password, salt)

        return {
          backend_user_account: user.backend_user_account,
          account_status: user.account_status,
          email: user.email,
          password: hashedPassword,
          creator: "system",
          editor: "system",
          createdAt: now,
          updatedAt: now,
        }
      })

      const backendUsersData = await Promise.all(backendUsersDataPromises)

      await queryInterface.bulkInsert("Backend_users", backendUsersData)

      const filePath = "./seedData/backendUsersData.json"
      utilHelper.writeToJSON(filePath, backendUsersData)
    } catch (err) {
      console.log(err)
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete("Backend_users", null, {})
  },
}
