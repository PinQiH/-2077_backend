require("dotenv").config()
const db = require("@models")
const { Op } = require("sequelize")
const repository = require("@repository")
const ExcelJS = require("exceljs")
const fs = require("fs-extra")
const archiver = require("archiver")
const path = require("path")
const bcrypt = require("bcrypt")
const xlsx = require("xlsx")
const moment = require("moment")
const jwt = require("jsonwebtoken")
const fastCSV = require("fast-csv")
const crypto = require("crypto")
const axios = require("axios")
const {
  ValidationError,
  DatabaseConflictError,
  PermissionError,
  ThirdPartyApiError,
} = require("@utils/error")
const { cfCheck } = require("@utils/cloudFlareTurnstile")
const { sendMail } = require("@utils/emailSender")
const {
  fetchLocalApiData,
  sendLocalApiData,
  deleteLocalApiData,
  modifiedLocalApiData,
} = require("@utils/localApiService")
const { validateInput } = require("@utils/validators")
const { snakeToCamel, getLaterDate } = require("@utils/utilHelper")
const { type } = require("os")
const { createObjectCsvWriter } = require("csv-writer")

const isDev = process.env.NODE_ENV === "development"

module.exports = {
  test: async (req, res, next) => {
    try {
      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "連線成功",
      })
    } catch (err) {
      err.code = "TEST_ERROR"
      next(err)
    }
  },
  dbPoolConnectionTest: async (req, res, next) => {
    async function getConnectionCount() {
      try {
        const pool = db.sequelize.connectionManager.pool
        const activeConnections = pool.size // 獲得活躍連接數
        const idleConnections = pool.available // 獲得空閒連接數
        const totalConnections = activeConnections + idleConnections

        console.log(`活躍連接數: ${activeConnections}`)
        console.log(`空閒連接數: ${idleConnections}`)
        console.log(`總連接數: ${totalConnections}`)
        return totalConnections || "0"
      } catch (error) {
        console.error("無法連接到資料庫:", error)
      }
    }
    const transaction = await db.sequelize.transaction()
    try {
      const connectionObject = {}

      connectionObject["1"] = await getConnectionCount()

      await db.Backend_users.findAll()

      connectionObject["2"] = await getConnectionCount()

      await transaction.commit()
      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "資料庫連線測試成功",
        data: connectionObject,
      })
    } catch (err) {
      await transaction.rollback()
      err.code = "dbPoolConnectionTest_ERROR"
      next(err)
    }
  },
}
