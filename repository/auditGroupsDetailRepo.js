const db = require("@models")
const { Op } = require("sequelize")
const {
  ValidationError,
  DatabaseConflictError,
  PermissionError,
  ThirdPartyApiError,
} = require("@utils/error")
const { snakeToCamel, getLaterDate } = require("@utils/utilHelper")

module.exports = {
  async handleAuditGroupDetails(
    auditGroupId,
    wordManagerUserAccounts,
    transaction
  ) {
    const existingMappings = await db.Audit_groups_detail.findAll({
      where: {
        word_manager_user_account: wordManagerUserAccounts,
      },
      transaction: transaction,
    })

    if (existingMappings.length > 0) {
      const alreadyMappedManagers = new Set(
        existingMappings.map((mapping) => mapping.word_manager_user_account)
      )
      return {
        message: `資料管理者帳號 ${Array.from(alreadyMappedManagers).join(
          ", "
        )} 已經與其他審核組配對。`,
      }
    }

    const auditGroupDetailsData = wordManagerUserAccounts.map(
      (managerAccount) => ({
        audit_group_id: auditGroupId,
        word_manager_user_account: managerAccount,
      })
    )

    await db.Audit_groups_detail.bulkCreate(auditGroupDetailsData, {
      transaction,
    })

    return {
      message: `success`,
    }
  },
  async distroyAuditGroupDetails(auditGroupId, transaction) {
    await db.Audit_groups_detail.destroy({
      where: { audit_group_id: auditGroupId },
      transaction,
    })
  },
  async getAuditGroupDetails(auditGroupId, transaction = null) {
    // 從資料庫中查詢特定群組的所有使用者對應資訊
    const users = await db.Audit_groups_detail.findAll({
      where: { audit_group_id: auditGroupId },
      attributes: ["word_manager_user_account"],
      transaction,
    })
    return users.map((user) => ({
      userAccount: user.word_manager_user_account,
    }))
  },
  async findAuditGroupDetails({
    auditGroupId,
    wordManagerUserAccount,
    createdAt,
    updatedAt,
  }) {
    try {
      const whereObject = {}

      if (auditGroupId) whereObject.audit_group_id = auditGroupId
      if (wordManagerUserAccount)
        whereObject.word_manager_user_account = wordManagerUserAccount

      if (createdAt) whereObject.createdAt = { [Op.gte]: createdAt }
      if (updatedAt) whereObject.updatedAt = { [Op.gte]: updatedAt }

      const AuditGroupDetailsData = await db.Audit_groups_detail.findAll({
        where: whereObject,
      })

      return AuditGroupDetailsData
    } catch (err) {
      // console.log(err)
      throw new DatabaseConflictError(err.message)
    }
  },
}
