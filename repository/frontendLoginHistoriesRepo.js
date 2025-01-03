const db = require("@models")
const { DatabaseConflictError } = require("@utils/error")
const { snakeToCamel } = require("@utils/utilHelper")

module.exports = {
  async createFrontUserLoginHistory(
    { username, email, loginStatus },
    transaction
  ) {
    try {
      const now = new Date()
      const frontUserLoginHistory = await db.FrontendLoginHistory.create(
        {
          username: username || null,
          email: email || null,
          login_status: loginStatus,
          createdAt: now,
          updatedAt: now,
        },
        { transaction }
      )

      return snakeToCamel(frontUserLoginHistory.get({ plain: true }))
    } catch (err) {
      console.log(err)
      throw new DatabaseConflictError(err.message)
    }
  },
}
