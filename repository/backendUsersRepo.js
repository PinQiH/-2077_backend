const db = require("@models")
const { Op } = require("sequelize")
const moment = require("moment-timezone")

module.exports = {
  async doesBackendUserAccountExist(backendUserAccount, transaction = null) {
    try {
      const existingUser = await db.Backend_users.findOne({
        where: { backend_user_account: backendUserAccount },
        transaction,
      })
      return existingUser
    } catch (err) {
      throw err
    }
  },
  async createUser(userData, transaction) {
    await db.Backend_users.create(userData, { transaction })
  },
  async findAndCountAllUsers(
    validatedData,
    currentPageSize,
    currentPage,
    transaction = null
  ) {
    // 構建 Sequelize 查詢選項
    const queryOptions = {
      where: {
        account_status: {
          [Op.ne]: -1, // 排除 account_status 為 -1 的資料
        },
      },
      include: [
        {
          model: db.User_Roles,
          include: [
            {
              model: db.Roles,
              attributes: ["role_id", "role_name", "role_status"],
              where: {},
              required: validatedData.roleIds ? true : false,
            },
          ],
        },
      ],
      attributes: [
        "backend_user_account",
        "createdAt",
        "creator",
        "updatedAt",
        "editor",
        "account_status",
      ],
      distinct: true, // 使用 distinct 來避免因關聯而導致的重複
      limit: currentPageSize, // 每頁顯示的數量
      offset: (currentPage - 1) * currentPageSize, // 跳過的記錄數
      order: [
        [
          validatedData.sortBy || "updatedAt",
          validatedData.sortDirection || "DESC",
        ],
        ["backend_user_account", "ASC"],
      ],
      transaction,
    }

    const convertToUTC = (dateString, timeZone) => {
      return moment.tz(dateString, timeZone).utc().format()
    }

    const timeZone = "Asia/Taipei"

    if (validatedData.createdAtStart && validatedData.createdAtEnd) {
      queryOptions.where.createdAt = {
        [Op.between]: [
          convertToUTC(validatedData.createdAtStart, timeZone),
          convertToUTC(validatedData.createdAtEnd, timeZone),
        ],
      }
    }
    if (validatedData.updatedAtStart && validatedData.updatedAtEnd) {
      queryOptions.where.updatedAt = {
        [Op.between]: [
          convertToUTC(validatedData.updatedAtStart, timeZone),
          convertToUTC(validatedData.updatedAtEnd, timeZone),
        ],
      }
    }
    if (validatedData.username) {
      queryOptions.where.backend_user_account = {
        [Op.like]: `%${validatedData.username}%`,
      }
    }
    if (validatedData.creator) {
      queryOptions.where.creator = {
        [Op.iLike]: `%${validatedData.creator}%`,
      }
    }
    if (validatedData.editor) {
      queryOptions.where.editor = {
        [Op.iLike]: `%${validatedData.editor}%`,
      }
    }
    if (validatedData.roleIds) {
      queryOptions.include[0].include[0].where.role_id = {
        [Op.in]: validatedData.roleIds,
      }
      queryOptions.include[0].include[0].where.role_status = 0
    }
    if (
      validatedData.status !== undefined &&
      validatedData.status !== null &&
      validatedData.status !== ""
    ) {
      queryOptions.where.account_status = validatedData.status
    }

    // 進行查詢
    const result = await db.Backend_users.findAndCountAll(queryOptions)

    // 計算總頁數
    // const totalPages = Math.ceil(result.count / currentPageSize)
    let totalCount
    if (validatedData.roleIds) {
      // 移除分頁選項來計算總記錄數
      const countOptions = { ...queryOptions }
      delete countOptions.limit
      delete countOptions.offset

      const data = await db.Backend_users.findAll({
        ...countOptions,
      })
      totalCount = data.length
    } else {
      totalCount = result.count
    }

    return {
      result: result,
      totalCount: totalCount,
    }
  },
  async updatePassword(
    userAccount,
    hashedPassword,
    editor,
    transaction = null
  ) {
    try {
      // 查找特定帳號的使用者
      const user = await module.exports.doesBackendUserAccountExist(
        userAccount,
        transaction
      )

      if (!user) {
        throw new Error("使用者不存在")
      }

      // 更新密碼
      user.password = hashedPassword
      user.editor = editor
      await user.save()

      return true // 返回真以表示密碼更新成功
    } catch (error) {
      throw error // 若有錯誤，拋出錯誤讓呼叫者處理
    }
  },
  async updateUserStatus(userAccount, newStatus, editor, transaction = null) {
    try {
      const result = await db.Backend_users.update(
        {
          account_status: newStatus,
          editor: editor,
        },
        {
          where: { backend_user_account: userAccount },
          transaction,
        }
      )

      // result 為更新後的文件，若找不到對應 ID，則 result 為 null
      if (result) {
        return true
      } else {
        return false
      }
    } catch (err) {
      throw err
    }
  },
  async updateBackendUser(userAccount, email, status, user, transaction) {
    try {
      // 更新使用者的基本資料
      await db.Backend_users.update(
        {
          email: email,
          account_status: status,
          editor: user,
        },
        {
          where: { backend_user_account: userAccount },
          transaction: transaction,
        }
      )
    } catch (error) {
      throw error
    }
  },
  async getUsersWithStatusZero(transaction = null) {
    return await db.Backend_users.findAll({
      where: { account_status: 0 },
      attributes: [
        "backend_user_account",
        "createdAt",
        "creator",
        "updatedAt",
        "editor",
      ],
      order: [["backend_user_account", "ASC"]],
      transaction,
    })
  },
  async getAccountInfo(account, transaction = null) {
    const queryOptions = {
      where: { backend_user_account: account },
      include: [
        {
          model: db.User_Roles,
          include: [
            {
              model: db.Roles,
              attributes: ["role_id", "role_name", "role_status"],
            },
          ],
        },
      ],
      attributes: ["backend_user_account", "email", "account_status"],
      transaction,
    }

    const user = await db.Backend_users.findOne(queryOptions)

    if (!user) return null

    // 假設返回的 user 是一個 Sequelize 模型實例
    const formattedData = {
      account: user.backend_user_account,
      email: user.email,
      accountStatus: user.account_status,
      roles: user.User_Roles.map((userRole) => ({
        roleId: userRole.Role.role_id,
        roleName: userRole.Role.role_name,
        roleStatus: userRole.Role.role_status,
      })),
    }

    return formattedData
  },
}
