const db = require("@models")
const { Op } = require("sequelize")

module.exports = {
  async createUserIP(userIp, creator, backendUserAccount, transaction) {
    let ipWhitelistEntry

    // 判斷提供的IP是單個還是範圍
    if (userIp.length === 1) {
      // 創建單一 IP 白名單條目
      ipWhitelistEntry = await db.IP_whitelists.create(
        {
          single_ip: userIp[0],
          ip_status: 0,
          creator: creator,
          editor: creator,
        },
        { transaction }
      )
    } else if (userIp.length === 2) {
      // 創建 IP 範圍的白名單條目
      ipWhitelistEntry = await db.IP_whitelists.create(
        {
          ip_start: userIp[0],
          ip_end: userIp[1],
          ip_status: 0,
          creator: creator,
          editor: creator,
        },
        { transaction }
      )
    }

    // 關聯後台使用者和 IP 白名單條目
    if (ipWhitelistEntry) {
      await db.User_IP_whitelists.create(
        {
          backend_user_account: backendUserAccount,
          whitelist_id: ipWhitelistEntry.whitelist_id,
          creator: creator,
          editor: creator,
        },
        { transaction }
      )
    }
  },
  async distroyUserIP(userAccount, transaction) {
    await db.User_IP_whitelists.destroy({
      where: { backend_user_account: userAccount },
      transaction: transaction,
    })
  },
}
