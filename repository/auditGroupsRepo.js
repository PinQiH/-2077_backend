const db = require("@models")
const { Sequelize, Op } = require("sequelize")
const moment = require("moment-timezone")
const auditGroupsDetailRepo = require("./auditGroupsDetailRepo")
const {
  ValidationError,
  DatabaseConflictError,
  PermissionError,
  ThirdPartyApiError,
} = require("@utils/error")
const { snakeToCamel, getLaterDate } = require("@utils/utilHelper")

module.exports = {
  async createAuditMapping(
    auditGroupName,
    auditUserAccount,
    wordManagerUserAccount,
    creator,
    transaction = null
  ) {
    const auditGroup = await db.Audit_groups.create(
      {
        audit_group_name: auditGroupName,
        audit_user_account: auditUserAccount,
        creator: creator,
        editor: creator,
      },
      { transaction }
    )

    if (wordManagerUserAccount && wordManagerUserAccount.length > 0) {
      const result = await auditGroupsDetailRepo.handleAuditGroupDetails(
        auditGroup.audit_group_id,
        wordManagerUserAccount,
        transaction
      )

      return result
    }
    return {
      message: "success",
    }
  },
  async getAllAuditMappings(validatedData, transaction = null) {
    const {
      auditGroupName,
      auditUserAccount,
      wordManagerUserAccounts,
      creator,
      editor,
      createdAtStart,
      createdAtEnd,
      updatedAtStart,
      updatedAtEnd,
      sortBy,
      sortDirection,
      page,
      pageSize,
    } = validatedData

    const convertToUTC = (dateString, timeZone) => {
      return moment.tz(dateString, timeZone).utc().format()
    }

    const timeZone = "Asia/Taipei"

    const where = {}
    if (auditGroupName) {
      where.audit_group_name = { [Op.like]: `%${auditGroupName}%` }
    }
    if (auditUserAccount) {
      where.audit_user_account = { [Op.like]: `%${auditUserAccount}%` }
    }
    if (creator) {
      where.creator = { [Op.iLike]: `%${creator}%` }
    }
    if (editor) {
      where.editor = { [Op.iLike]: `%${editor}%` }
    }
    if (createdAtStart && createdAtEnd) {
      where.createdAt = {
        [Op.between]: [
          convertToUTC(createdAtStart, timeZone),
          convertToUTC(createdAtEnd, timeZone),
        ],
      }
    }
    if (updatedAtStart && updatedAtEnd) {
      where.updatedAt = {
        [Op.between]: [
          convertToUTC(updatedAtStart, timeZone),
          convertToUTC(updatedAtEnd, timeZone),
        ],
      }
    }

    // Adding a conditional filter for word manager user accounts if provided
    const includes = []
    if (wordManagerUserAccounts) {
      includes.push({
        model: db.Audit_groups_detail,
        where: {
          word_manager_user_account: { [Op.in]: wordManagerUserAccounts },
        },
        attributes: ["word_manager_user_account"],
      })
    } else {
      includes.push({
        model: db.Audit_groups_detail,
        attributes: ["word_manager_user_account"],
      })
    }

    const order = [
      [sortBy, sortDirection],
      ["audit_group_id", "ASC"],
    ]
    const limit = parseInt(pageSize, 10)
    const offset = (parseInt(page, 10) - 1) * limit

    const result = await db.Audit_groups.findAndCountAll({
      where,
      include: includes,
      order,
      limit,
      offset,
      distinct: true,
      transaction,
    })

    return { rows: result.rows, count: result.count }
  },
  async updateAuditMapping(
    auditGroupId,
    auditGroupName,
    auditUserAccount,
    wordManagerUserAccounts,
    editor,
    transaction = null
  ) {
    try {
      await db.Audit_groups.update(
        {
          audit_group_name: auditGroupName,
          audit_user_account: auditUserAccount,
          editor: editor,
        },
        { where: { audit_group_id: auditGroupId }, transaction }
      )

      // 如果提供了 wordManagerUserAccounts，則更新相關對應
      if (wordManagerUserAccounts) {
        await auditGroupsDetailRepo.distroyAuditGroupDetails(
          auditGroupId,
          transaction
        )

        const result = await auditGroupsDetailRepo.handleAuditGroupDetails(
          auditGroupId,
          wordManagerUserAccounts,
          transaction
        )
        return result
      }

      return {
        message: "success",
      }
    } catch (error) {
      throw error // 請確保錯誤被正確處理或傳遞
    }
  },
  async getSubordinateUserAccounts(auditUserAccount, transaction = null) {
    // 找出與審核者相關的所有審核組ID
    const auditGroups = await db.Audit_groups.findAll({
      where: { audit_user_account: auditUserAccount },
      attributes: ["audit_group_id"],
      raw: true,
      transaction,
    })

    // 從審核組中提取所有的 audit_group_id
    const auditGroupIds = auditGroups.map((group) => group.audit_group_id)

    // 根據審核組ID，找出所有資料管理者的帳號
    const auditGroupDetails = await db.Audit_groups_detail.findAll({
      where: { audit_group_id: auditGroupIds },
      attributes: ["word_manager_user_account"],
      raw: true,
      transaction,
    })

    // 從審核組細節中提取所有的資料管理者帳號，並去重
    const uniqueManagerAccounts = [
      ...new Set(
        auditGroupDetails.map((detail) => detail.word_manager_user_account)
      ),
    ]

    return uniqueManagerAccounts
  },
  async getAuditUserAccountByCreator(creator, transaction = null) {
    try {
      // 查找 AuditGroupsDetail 中符合 creator 的記錄
      const auditGroupDetails = await db.Audit_groups_detail.findAll({
        where: { word_manager_user_account: creator },
        include: [
          {
            model: db.Audit_groups,
            attributes: ["audit_user_account"],
          },
        ],
        transaction,
      })

      // 提取所有的 audit_user_account
      const auditUserAccounts = auditGroupDetails.map(
        (detail) => detail.Audit_group.audit_user_account
      )

      return auditUserAccounts
    } catch (error) {
      throw error
    }
  },
  async getDistinctAuditUserAccounts() {
    try {
      // 使用 findAll 方法來查找所有唯一的 audit_user_account
      const auditUserAccounts = await db.Audit_groups.findAll({
        attributes: [
          [
            Sequelize.fn("DISTINCT", Sequelize.col("audit_user_account")),
            "audit_user_account",
          ],
        ],
      })

      // 提取並回傳 distinct 的 audit_user_account
      return auditUserAccounts.map((record) => record.audit_user_account)
    } catch (error) {
      // console.log(error)
      throw new DatabaseConflictError(error.message)
    }
  },
}
