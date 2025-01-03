const db = require("@models")
const { Op } = require("sequelize")
const moment = require("moment-timezone")
const rolePermissionsRepo = require("./rolePermissionsRepo")

module.exports = {
  async findActiveRoles(transaction = null) {
    return await db.Roles.findAll({
      where: { role_status: 0 },
      attributes: ["role_id", "role_name"],
      order: [["role_name", "ASC"]],
      transaction,
    })
  },
  async findByName(name, { transaction } = {}) {
    // 搜索角色名是否存在
    return await db.Roles.findOne({ where: { role_name: name }, transaction })
  },
  async createRole(roleData, { transaction } = {}) {
    return await db.Roles.create(roleData, {
      transaction,
    })
  },
  async getRoleById(roleId, transaction = null) {
    return await db.Roles.findAll({ where: { role_id: roleId }, transaction })
  },
  async updateRoleStatus(roleId, status, user, transaction = null) {
    return await db.Roles.update(
      {
        role_status: status,
        editor: user,
      },
      {
        where: { role_id: roleId },
        transaction,
      }
    )
  },
  async findAndCountAllRoles(validatedData, transaction = null) {
    const where = {
      role_status: { [Op.ne]: -1 }, // 排除 role_status 為 -1 的條目
    }

    const convertToUTC = (dateString, timeZone) => {
      return moment.tz(dateString, timeZone).utc().format()
    }

    const timeZone = "Asia/Taipei"

    if (validatedData.roleName) {
      where.role_name = {
        [Op.in]: validatedData.roleName,
      }
    }
    if (validatedData.createdAtStart && validatedData.createdAtEnd) {
      where.createdAt = {
        [Op.between]: [
          convertToUTC(validatedData.createdAtStart, timeZone),
          convertToUTC(validatedData.createdAtEnd, timeZone),
        ],
      }
    }
    if (validatedData.updatedAtStart && validatedData.updatedAtEnd) {
      where.updatedAt = {
        [Op.between]: [
          convertToUTC(validatedData.updatedAtStart, timeZone),
          convertToUTC(validatedData.updatedAtEnd, timeZone),
        ],
      }
    }
    if (validatedData.creator) {
      where.creator = { [Op.iLike]: `%${validatedData.creator}%` }
    }
    if (validatedData.editor) {
      where.editor = { [Op.iLike]: `%${validatedData.editor}%` }
    }
    if (
      validatedData.status !== undefined &&
      validatedData.status !== null &&
      validatedData.status !== ""
    ) {
      where.role_status = validatedData.status
    }
    const order = [
      [validatedData.sortBy, validatedData.sortDirection],
      ["role_id", "ASC"],
    ]

    const rolesData = await db.Roles.findAndCountAll({
      where,
      order,
      limit: parseInt(validatedData.pageSize), // 限制一頁顯示的數量
      offset: (validatedData.page - 1) * validatedData.pageSize, // 跳過的記錄數量
      attributes: [
        "role_id",
        "role_name",
        "createdAt",
        "creator",
        "updatedAt",
        "editor",
        "role_status",
      ],
      transaction,
    })

    return rolesData
  },
  async updateRoleById(
    roleId,
    roleName,
    status,
    permissions,
    editor,
    transaction
  ) {
    try {
      // 更新角色基本信息
      const role = await db.Roles.update(
        {
          role_name: roleName,
          role_status: status,
          editor: editor,
        },
        {
          where: { role_id: roleId },
          transaction: transaction,
        }
      )

      // 檢查更新是否成功
      if (!role) {
        throw error
      }

      // 新增更新後的角色權限關聯
      const newPermissions = permissions.map((permissionId) => ({
        role_id: roleId,
        permission_id: permissionId,
        creator: editor,
        editor: editor,
      }))

      // 先刪除角色的現有權限關聯
      await db.Role_Permissions.destroy({
        where: { role_id: roleId },
        transaction,
      })

      // 新增角色的權限關聯
      await db.Role_Permissions.bulkCreate(newPermissions, {
        transaction,
      })

      // await rolePermissionsRepo.setRolePermissions(newPermissions, {
      //   transaction,
      // })
    } catch (error) {
      // 發生錯誤，回滾事務
      throw error
    }
  },
}
