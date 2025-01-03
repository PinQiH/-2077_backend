"use strict"
const fs = require("fs")
require("module-alias/register")
const utilHelper = require("@utils/utilHelper")

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const now = new Date()
    const loginHistoriesList = JSON.parse(
      fs.readFileSync("./seedData/initSetting.json")
    )["loginHistoriesList"]

    const loginHistoriesBulkData = loginHistoriesList.map((loginHistory) => {
      return {
        backend_user_account: loginHistory.backend_user_account,
        ip_address: loginHistory.ip_address,
        login_status: loginHistory.login_status,
        createdAt: now,
        updatedAt: now,
      }
    })

    // 將資料插入到 Backend_login_histories 表中
    await queryInterface.bulkInsert(
      "Backend_login_histories",
      loginHistoriesBulkData
    )

    const filePath = "./seedData/backendLoginHistoriesData.json"
    utilHelper.writeToJSON(filePath, loginHistoriesBulkData)
  },

  down: async (queryInterface, Sequelize) => {
    // 在向下遷移時，您可以選擇刪除剛才插入的資料，或者根據您的需求進行其他處理
    await queryInterface.bulkDelete("Backend_login_histories", null, {})
  },
}
