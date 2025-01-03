const db = require("@models")
const { Op } = require("sequelize")
const rolesRepo = require("./rolesRepo")

module.exports = {
  async setRolePermissions(rolePermissions, { transaction } = {}) {
    // 先刪除角色的現有權限關聯
    await db.Role_Permissions.destroy({
      where: { role_id: rolePermissions[0].role_id },
      transaction,
    })

    // 新增角色的權限關聯
    await db.Role_Permissions.bulkCreate(rolePermissions, {
      transaction,
    })
  },
  async getRolePermissionsById(roleId, transaction = null) {
    try {
      const roles = await rolesRepo.getRoleById(roleId, transaction)

      // 直接聯表查詢權限名稱
      const permissions = await db.Role_Permissions.findAll({
        where: { role_id: roleId },
        include: [
          {
            model: db.Permissions,
            attributes: ["permission_id", "permission_name"],
            required: true,
          },
        ],
        raw: true,
        transaction,
      })

      if (permissions.length === 0) {
        return null // 如果找不到任何權限，返回 null
      }

      // 格式化返回的權限數據
      const formattedPermissions = permissions.map((p) => ({
        permissionId: p["Permission.permission_id"],
        permissionName: p["Permission.permission_name"],
      }))

      // 返回整理後的數據格式
      return {
        roleId: roleId,
        creator: roles.creator,
        editor: roles.editor,
        createdAt: roles.createdAt,
        updatedAt: roles.updatedAt,
        permissions: formattedPermissions,
      }
    } catch (error) {
      throw error // 將錯誤向上拋出，由調用者處理
    }
  },
  async getChildRolePermissionsById(roleIds, parentId, transaction = null) {
    try {
      return db.Role_Permissions.findAll({
        where: {
          role_id: roleIds,
        },
        include: [
          {
            model: db.Permissions,
            where: { parent_permission_id: parentId },
            attributes: [
              "permission_id",
              "permission_name",
              "permission_sequence",
              "permission_type",
            ],
            required: true,
          },
        ],
        raw: true,
        transaction,
      })
    } catch (error) {
      throw error // 將錯誤向上拋出，由調用者處理
    }
  },
}
