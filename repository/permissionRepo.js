const db = require("@models")
const { Op } = require("sequelize")

module.exports = {
  async getPagesAndButtons(isAdmin, transaction = null) {
    return await db.Permissions.findAll({
      where: {
        parent_permission_id: null,
        ...(isAdmin ? {} : { admin_only: false }),
      }, // 僅選擇主頁面
      include: [
        {
          model: db.Permissions, // 自關聯以包含子頁面和按鈕資訊
          as: "children",
          attributes: [
            "permission_id",
            "permission_name",
            "permission_sequence",
            "permission_type",
          ],
          where: { ...(isAdmin ? {} : { admin_only: false }) }, // 包含子頁面和按鈕
          required: false,
          order: [["permission_sequence", "ASC"]], // 按序列排序
          transaction,
        },
      ],
      attributes: [
        "permission_id",
        "permission_name",
        "permission_sequence",
        "permission_type",
      ],
      order: [["permission_sequence", "ASC"]],
    })
  },
}
