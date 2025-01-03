const db = require("@models")
const { Op } = require("sequelize")
const moment = require("moment-timezone")
const { required } = require("joi")

module.exports = {
  async createFrontendUser(data, transaction = null) {
    return await db.Frontend_users.create(data, { transaction })
  },

  async createMultipleFrontendUsers(dataArray, transaction = null) {
    await db.Frontend_users.bulkCreate(dataArray, { transaction })
  },

  async updateFrontendUserById(id, data, transaction = null) {
    return await db.Frontend_users.update(data, {
      where: { user_id: id },
      transaction,
    })
  },

  async updateFrontendUserByEmail(username, data, transaction = null) {
    await db.Frontend_users.update(data, {
      where: { username: username },
      transaction,
    })
  },

  async findAllFrontendUsers(query = {}, transaction = null) {
    const users = await db.Frontend_users.findAll({
      where: query,
      transaction,
    })
    return users
  },

  async findFrontendUserById(id, transaction = null) {
    const user = await db.Frontend_users.findOne({
      attributes: [
        "user_id",
        "username",
        "email",
        "password_hash",
        "account_status",
        "createdAt",
        "updatedAt",
        "deletedAt",
      ],
      where: { user_id: id },
      include: [
        {
          model: db.UserProfiles,
          attributes: [
            "contact_person_name",
            "contact_phone_office",
            "contact_phone_mobile",
            "contact_department",
            "contact_position",
            "contact_email",
          ],
        },
      ],
      transaction,
    })
    return user
  },

  async findFrontendUserProfileById(id, transaction = null) {
    const user = await db.Frontend_users.findOne({
      attributes: ["user_id", "username", "account_status"],
      where: { user_id: id },
      transaction,
    })
    return user
  },

  async findFrontendUserByEmail({
    username,
    email,
    accountStatus,
    transaction = null,
  }) {
    const whereObject = {}

    if (username) whereObject.username = username
    if (email) whereObject.email = email
    if (accountStatus) whereObject.account_status = accountStatus

    const user = await db.Frontend_users.findOne({
      where: whereObject,
      include: [
        {
          model: db.UserProfiles,
        },
      ],
      transaction,
    })
    return user
  },

  async deleteFrontendUser(id, transaction = null) {
    await db.Frontend_users.update(
      { status: 1 },
      {
        where: { user_id: id },
        transaction,
      }
    )

    await db.Frontend_users.destroy({
      where: { user_id: id },
      transaction,
    })
  },

  async listMembers({
    page = 1,
    size = 10,
    sortField = "createdAt",
    sortOrder = "DESC",
    registeredAtStart, // 註冊日期(起)
    registeredAtEnd, // 註冊日期(迄)
    username, // 帳號
    contactPersonName, // 聯絡人名稱
    contactPersonDepartment, // 聯絡人部門
    contactPersonPosition, // 聯絡人職稱
    status, // 狀態
    transaction = null,
  }) {
    // 設定時區
    const convertToUTC = (dateString, timeZone) => {
      return moment.tz(dateString, timeZone).utc().format()
    }
    const timeZone = "Asia/Taipei"

    // 分頁
    const offset = (page - 1) * size
    const limit = parseInt(size)

    const whereConditions = {}
    const userProfileWhereConditions = {}

    // 構建搜尋條件
    if (registeredAtStart || registeredAtEnd) {
      whereConditions.createdAt = {}
      const startOfDay = (date, timeZone) => {
        const utcDate = new Date(convertToUTC(date, timeZone))
        utcDate.setUTCDate(utcDate.getUTCDate() + 1)
        utcDate.setUTCHours(0, 0, 0, 0)
        return utcDate
      }

      const endOfDay = (date, timeZone) => {
        const utcDate = new Date(convertToUTC(date, timeZone))
        utcDate.setUTCDate(utcDate.getUTCDate() + 1)
        utcDate.setUTCHours(23, 59, 59, 999)
        return utcDate
      }

      if (registeredAtStart === registeredAtEnd) {
        whereConditions.createdAt = {
          [Op.gte]: startOfDay(registeredAtStart, timeZone),
          [Op.lte]: endOfDay(registeredAtStart, timeZone),
        }
      } else if (registeredAtStart && registeredAtEnd) {
        whereConditions.createdAt = {
          [Op.gte]: startOfDay(registeredAtStart, timeZone),
          [Op.lte]: endOfDay(registeredAtEnd, timeZone),
        }
      } else if (registeredAtStart) {
        whereConditions.createdAt[Op.gte] = startOfDay(
          registeredAtStart,
          timeZone
        )
      } else if (registeredAtEnd) {
        whereConditions.createdAt[Op.lte] = endOfDay(registeredAtEnd, timeZone)
      }
    }
    if (status) {
      whereConditions.account_status = status
    }
    if (username) {
      whereConditions.username = {
        [Op.iLike]: `%${username}%`,
      }
    }
    if (contactPersonName) {
      userProfileWhereConditions.contact_person_name = {
        [Op.iLike]: `%${contactPersonName}%`,
      }
    }
    if (contactPersonDepartment) {
      userProfileWhereConditions.contact_department = {
        [Op.iLike]: `%${contactPersonDepartment}%`,
      }
    }
    if (contactPersonPosition) {
      userProfileWhereConditions.contact_position = {
        [Op.iLike]: `%${contactPersonPosition}%`,
      }
    }

    // 查詢數據庫
    const { count, rows } = await db.Frontend_users.findAndCountAll({
      attributes: ["user_id", "username", "account_status", "createdAt"],
      include: [
        {
          model: db.UserProfiles,
          attributes: [
            "contact_person_name",
            "contact_phone_mobile",
            "contact_department",
            "contact_position",
            "contact_email",
          ],
          where: userProfileWhereConditions,
        },
      ],
      where: whereConditions,
      order: [
        [sortField, sortOrder],
        ["user_id", "DESC"],
      ],
      offset,
      limit,
      distinct: true,
      transaction,
    })

    // 計算總頁數
    const totalPages = Math.ceil(count / limit)

    return { count, rows, totalPages }
  },

  async isUserDeleted(userId) {
    const user = await db.Frontend_users.findOne({
      where: {
        user_id: userId,
      },
      attributes: ["deletedAt"], // 只查詢 deletedAt 欄位
    })

    if (!user) {
      throw new Error("用戶不存在")
    }

    // 檢查 deletedAt 是否為 null
    return user.deletedAt !== null
  },

  async usernameUnique({ username, transaction = null }) {
    const whereObject = {}

    if (username) whereObject.username = username

    const user = await db.Frontend_users.findOne({
      where: whereObject,
      paranoid: false, // 包含已被軟刪除的記錄
      transaction,
    })
    return user
  },
}
