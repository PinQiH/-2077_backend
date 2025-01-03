const db = require("@models")
const { Op } = require("sequelize")

module.exports = {
  async createUserRoles(backendUserAccount, roleId, creator, transaction) {
    await db.User_Roles.create(
      {
        backend_user_account: backendUserAccount,
        role_id: roleId,
        creator: creator,
        editor: creator,
      },
      { transaction }
    )
  },
  async distroyUserRoles(userAccount, transaction) {
    await db.User_Roles.destroy({
      where: { backend_user_account: userAccount },
      transaction: transaction,
    })
  },
  async findUserRoles(roleId, transaction = null) {
    const users = await db.User_Roles.findAll({
      where: { role_id: roleId },
      attributes: ["backend_user_account"],
      transaction,
    })

    return users
  },
  async getUserRoles(userAccount, transaction = null) {
    const users = await db.User_Roles.findAll({
      where: { backend_user_account: userAccount },
      attributes: ["role_id"],
      transaction,
    })

    return users
  },
}
