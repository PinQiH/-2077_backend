const db = require("@models")
const { Op } = require("sequelize")
const { DatabaseConflictError } = require("@utils/error")
const { snakeToCamel } = require("@utils/utilHelper")

module.exports = {
  async createVerificationLink(
    { username, email, token, statusCode, expireAt },
    transaction
  ) {
    try {
      const createdLinkData = await db.RegisterVerifyLink.create(
        {
          username: username || null,
          email: email || null,
          verify_token: token,
          expire_at: expireAt,
          token_status: statusCode,
        },
        { transaction }
      )

      return snakeToCamel(createdLinkData.get({ plain: true }))
    } catch (err) {
      // console.log(err)
      throw new DatabaseConflictError(err.message)
    }
  },
  async findVerificationLinks({ username, email, token, status, latest }) {
    const where = {}
    if (username) where.username = username
    if (email) where.email = email
    if (token) where.verify_token = token
    if (typeof status !== "undefined") where.token_status = status

    const options = {
      where,
      order: [["createdAt", "DESC"]],
    }

    // 如果需要最近一期的記錄，可能會將其限制為只返回一條記錄
    if (latest) {
      options.limit = 1
    }

    const linkData = await db.RegisterVerifyLink.findAll(options)

    return linkData.map((link) => snakeToCamel(link.get({ plain: true })))
  },
  async updateVerificationLink(
    { username, email, token, newStatus },
    transaction
  ) {
    try {
      const whereObj = {}
      if (username) whereObj.username = username
      if (email) whereObj.email = email
      if (token) whereObj.verify_token = token

      const updateObj = {}
      if (typeof newStatus !== "undefined") updateObj.token_status = newStatus // (0:active, 1: verified, 2: invalid)

      if (newStatus === undefined || newStatus === null) {
        throw "No data to update"
      }

      const updatedLinkData = await db.RegisterVerifyLink.update(updateObj, {
        where: whereObj,
        transaction,
      })

      return updatedLinkData
    } catch (err) {
      // console.log(err)
      throw new DatabaseConflictError(err)
    }
  },
}
