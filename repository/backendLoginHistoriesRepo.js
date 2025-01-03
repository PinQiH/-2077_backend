const db = require("@models")
const {
  ValidationError,
  DatabaseConflictError,
  PermissionError,
  ThirdPartyApiError,
} = require("@utils/error")
const { snakeToCamel, getLaterDate } = require("@utils/utilHelper")

module.exports = {
  async createBackendUserLoginHistory(
    { account, loginStatus, ipAddress },
    transaction
  ) {
    try {
      const now = new Date()
      const BackendUserLoginHistory = await db.Backend_login_histories.create(
        {
          backend_user_account: account,
          login_status: loginStatus,
          ip_address: ipAddress,
          createdAt: now,
          updatedAt: now,
        },
        { transaction }
      )

      return utilHelper.snakeToCamel(
        BackendUserLoginHistory.get({ plain: true })
      )
    } catch (err) {
      // console.log(err)
      throw new DatabaseConflictError(err.message)
    }
  },
  async findBackendUserLoginHistories(
    { account, limit, status },
    transaction = null
  ) {
    try {
      const options = {
        where: { backend_user_account: account },
        order: [["createdAt", "DESC"]],
        transaction,
      }

      if (limit) {
        options.limit = limit
      }

      // 只有在 status 有有效值時才添加到查詢條件
      if (status !== undefined) {
        options.where.login_status = status
      }

      const loginHistories = await db.Backend_login_histories.findAll(options)

      if (!loginHistories || loginHistories.length === 0) {
        return []
      }

      return loginHistories.map((history) =>
        utilHelper.snakeToCamel(history.get({ plain: true }))
      )
    } catch (err) {
      // console.log(err)
      throw new DatabaseConflictError(err.message)
    }
  },
}
