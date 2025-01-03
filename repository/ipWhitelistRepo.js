const db = require("@models")
const { Op } = require("sequelize")
const moment = require("moment-timezone")
const {
  ValidationError,
  DatabaseConflictError,
  PermissionError,
  ThirdPartyApiError,
} = require("@utils/error")
const { snakeToCamel, getLaterDate } = require("@utils/utilHelper")

module.exports = {
  async addIP({ name, singleIp, ipStart, ipEnd, user }, transaction = null) {
    // 判斷提供的IP是單個還是範圍
    if (singleIp) {
      // 創建單一 IP 白名單條目
      return await db.IP_whitelists.create(
        {
          name: name,
          single_ip: singleIp,
          ip_status: 0,
          creator: user,
          editor: user,
        },
        { transaction }
      )
    } else if (ipStart && ipEnd) {
      // 創建 IP 範圍的白名單條目
      return await db.IP_whitelists.create(
        {
          name: name,
          ip_start: ipStart,
          ip_end: ipEnd,
          ip_status: 0,
          creator: user,
          editor: user,
        },
        { transaction }
      )
    } else {
      throw new Error()
    }
  },
  async searchIP({
    ip,
    name,
    userAccount,
    whitelistId,
    createdAtStart,
    createdAtEnd,
    updatedAtStart,
    updatedAtEnd,
    sortBy,
    sortDirection,
    limit,
    offset,
    transaction = null,
  }) {
    const convertToUTC = (dateString, timeZone) => {
      return moment.tz(dateString, timeZone).utc().format()
    }

    const timeZone = "Asia/Taipei"

    const userAccountConditions = userAccount
      ? [
          { creator: { [Op.like]: `%${userAccount}%` } },
          { editor: { [Op.like]: `%${userAccount}%` } },
        ]
      : []

    const ipConditions = ip
      ? [
          { single_ip: { [Op.like]: `%${ip}%` } },
          { ip_start: { [Op.like]: `%${ip}%` } },
          { ip_end: { [Op.like]: `%${ip}%` } },
        ]
      : []

    const whereConditions = []

    // 當 whitelistId 存在時，忽略其他查詢條件，直接用 whitelistId 查詢
    if (whitelistId) {
      whereConditions.push({ whitelist_id: whitelistId })
    } else {
      if (userAccountConditions.length > 0) {
        whereConditions.push({ [Op.or]: userAccountConditions })
      }
      if (ipConditions.length > 0) {
        whereConditions.push({ [Op.or]: ipConditions })
      }
      if (name) {
        whereConditions.push({ name: { [Op.like]: `%${name}%` } })
      }
      if (createdAtStart && createdAtEnd) {
        whereConditions.push({
          createdAt: {
            [Op.between]: [
              convertToUTC(createdAtStart, timeZone),
              convertToUTC(createdAtEnd, timeZone),
            ],
          },
        })
      }
      if (updatedAtStart && updatedAtEnd) {
        whereConditions.push({
          updatedAt: {
            [Op.between]: [
              convertToUTC(updatedAtStart, timeZone),
              convertToUTC(updatedAtEnd, timeZone),
            ],
          },
        })
      }
    }

    const queryOptions = {
      where: {
        [Op.and]: whereConditions,
      },
      limit,
      offset,
      order: [
        [sortBy, sortDirection],
        ["whitelist_id", "ASC"],
      ],
      transaction,
    }

    const results = await db.IP_whitelists.findAndCountAll(queryOptions)
    const data = results.rows.map((row) =>
      utilHelper.snakeToCamel(row.get({ plain: true }))
    )

    return {
      data: data,
      pagination: {
        page: parseInt(offset / limit) + 1,
        perPage: limit,
        totalCount: results.count,
        totalPages: Math.ceil(results.count / limit),
      },
    }
  },
  async updateIPWhitelist(
    { id, name, singleIp, ipStart, ipEnd, user },
    transaction = null
  ) {
    const whitelist = await db.IP_whitelists.findByPk(id, { transaction })
    if (!whitelist) {
      return null
    }

    whitelist.name = name || whitelist.name
    whitelist.editor = user || whitelist.editor

    whitelist.single_ip = singleIp !== undefined ? singleIp : null
    whitelist.ip_start = ipStart !== undefined ? ipStart : null
    whitelist.ip_end = ipEnd !== undefined ? ipEnd : null

    await whitelist.save({ transaction })
    return whitelist
  },
  async deleteIPWhitelist(id, transaction = null) {
    return await db.IP_whitelists.destroy({
      where: { whitelist_id: id },
      transaction,
    })
  },
  async isIpWhitelisted(ip) {
    // 檢查單個 IP 和 IP 範圍
    const ipWhitelistEntries = await db.IP_whitelists.findAll({
      where: {
        [Op.or]: [
          { single_ip: ip },
          {
            [Op.and]: [
              { ip_start: { [Op.lte]: ip } },
              { ip_end: { [Op.gte]: ip } },
            ],
          },
        ],
        ip_status: 0, // 確保只檢查有效的 IP 白名單條目
      },
    })

    // 如果找到匹配的條目，則 IP 在白名單中
    return ipWhitelistEntries.length > 0
  },
}
