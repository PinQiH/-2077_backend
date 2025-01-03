"use strict"
const crypto = require("crypto")
const fs = require("fs")
require("module-alias/register")
const utilHelper = require("@utils/utilHelper")
const bcrypt = require("bcrypt")

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      const now = new Date()
      const UsersList = JSON.parse(
        fs.readFileSync("./seedData/initSetting.json")
      )["usersList"]
      const salt = await bcrypt.genSalt(10)

      const UsersDataPromises = UsersList.map(async (user) => {
        const hashedPassword = await bcrypt.hash(user.password, salt)

        return {
          username: user.username,
          email: user.email,
          password_hash: hashedPassword,
          account_status: user.account_status || 0,
          createdAt: now,
          updatedAt: now,
        }
      })

      const UsersData = await Promise.all(UsersDataPromises)

      await queryInterface.bulkInsert("Frontend_users", UsersData)

      const filePath = "./seedData/UsersData.json"
      utilHelper.writeToJSON(filePath, UsersData)
    } catch (err) {
      console.log(err)
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete("Frontend_users", null, {})
  },
}
