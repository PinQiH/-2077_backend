const express = require("express")
const router = express.Router()
const { authenticated } = require("@middleware/auth")
const { checkBOAdminAccess } = require("@middleware/auth")
const operateLogger = require("@middleware/operateLogger")
const { errorHandler } = require("@middleware/errorHandler")
const apisControllerV1 = require("@controllers/user-management-apisController")

// >後台使用者管理
// -後台帳號管理 API
router.post("/backend-users/login", operateLogger, apisControllerV1["BOlogin"]) // 登入
router.post(
  "/backend-users/logout",
  operateLogger,
  apisControllerV1["BOlogout"]
) // 登出
router.post(
  "/backend-users/permission/page/:pageId",
  authenticated,
  operateLogger,
  apisControllerV1["BOgetPermissionByPage"]
) // 查詢-頁面按鈕權限
router.get(
  "/backend-users",
  authenticated,
  checkBOAdminAccess,
  operateLogger,
  apisControllerV1["BOgetBackendUsersList"]
) // 查詢-後台使用者列表
router.get(
  "/roles/active",
  authenticated,
  // checkBOAdminAccess,
  operateLogger,
  apisControllerV1["BOgetActiveRoles"]
) // 查詢-下拉選單-角色
router.post(
  "/backend-users",
  authenticated,
  checkBOAdminAccess,
  operateLogger,
  apisControllerV1["BOcreateBackendUser"]
) // 新增-後台使用者
router.post(
  "/backend-users/update",
  authenticated,
  checkBOAdminAccess,
  operateLogger,
  apisControllerV1["BOupdateBackendUser"]
) // 修改-後台使用者
router.post(
  "/backend-users/password",
  authenticated,
  checkBOAdminAccess,
  operateLogger,
  apisControllerV1["BOchangeUserPassword"]
) // 修改-後台使用者密碼
router.post(
  "/backend-users/status",
  authenticated,
  checkBOAdminAccess,
  operateLogger,
  apisControllerV1["BOtoggleUserStatus"]
) // 修改-啟用/禁用
router.post(
  "/auth/validate-boadmin-password",
  authenticated,
  checkBOAdminAccess,
  operateLogger,
  apisControllerV1["BOvalidateBOAdminPassword"]
) // 查詢-檢查BOAdmin密碼
router.get(
  "/backend-users/dropdown",
  // authenticated,
  // checkBOAdminAccess,
  operateLogger,
  apisControllerV1["BOgetBackendUsersDropdown"]
) // 後台使用者下拉選單
router.post(
  "/backend-users/account-info",
  // authenticated,
  // checkBOAdminAccess,
  operateLogger,
  apisControllerV1["BOgetBackendUsersInfo"]
) // 取得帳號的資訊

// -前台會員管理 API
router.get(
  "/members",
  authenticated("backend"),
  operateLogger,
  apisControllerV1["listMembers"]
) // 會員管理-列表
router.get("/members/:userId", operateLogger, apisControllerV1["getMember"]) // 會員管理-查詢
router.post(
  "/members",
  authenticated("backend"),
  operateLogger,
  apisControllerV1["createMember"]
) // 會員管理-新增
router.put(
  "/members",
  authenticated("backend"),
  operateLogger,
  apisControllerV1["updateMember"]
) // 會員管理-修改
router.delete(
  "/members/:userId",
  authenticated("backend"),
  operateLogger,
  apisControllerV1["deleteMember"]
) // 會員管理-刪除

// -角色管理 API
router.get(
  "/roles",
  authenticated,
  checkBOAdminAccess,
  operateLogger,
  apisControllerV1["BOgetRolesList"]
) // 查詢-角色列表
router.get(
  "/roles/:roleId/users",
  authenticated,
  checkBOAdminAccess,
  operateLogger,
  apisControllerV1["BOgetUsersByRole"]
) // 查詢-檢視角色底下的使用者帳號
router.get(
  "/roles/:roleId/permissions",
  authenticated,
  checkBOAdminAccess,
  operateLogger,
  apisControllerV1["BOgetRolePermissions"]
) // 查詢-檢視角色的功能權限
router.post(
  "/roles",
  authenticated,
  checkBOAdminAccess,
  operateLogger,
  apisControllerV1["BOcreateRole"]
) // 新增-角色
router.get(
  "/roles/pages-buttons",
  authenticated,
  // checkBOAdminAccess,
  operateLogger,
  apisControllerV1["BOgetPagesAndButtonsList"]
) // 查詢-頁面與功能按鈕的list
router.put(
  "/roles/roles/:roleId",
  authenticated,
  checkBOAdminAccess,
  operateLogger,
  apisControllerV1["BOupdateRole"]
) // 修改-角色
router.patch(
  "/roles/roles/:roleId/status",
  authenticated,
  checkBOAdminAccess,
  operateLogger,
  apisControllerV1["BOtoggleRoleStatus"]
) // 修改-啟用/禁用

// -資料管理者與審核者對應 API
router.get(
  "/user-management/audit-mappings",
  operateLogger,
  apisControllerV1["BOgetAuditMappings"]
) // 查詢
router.post(
  "/user-management/audit-mappings",
  authenticated,
  operateLogger,
  apisControllerV1["BOcreateAuditMapping"]
) // 新增
router.put(
  "/user-management/audit-mappings",
  authenticated,
  operateLogger,
  apisControllerV1["BOupdateAuditMapping"]
) // 修改
router.get(
  "/user-management/audit-mappings/:auditGroupId",
  operateLogger,
  apisControllerV1["BOgetAuditMappingById"]
) // 列出群組內容

// -後台首頁 API
router.post(
  "/dashboard/login",
  authenticated,
  operateLogger,
  apisControllerV1["BOgetloginHistory"]
) // 登入紀錄

// -IP管理 API
router.post(
  "/ip-whitelists",
  authenticated,
  checkBOAdminAccess,
  operateLogger,
  apisControllerV1["BOaddIPWhitelist"]
) // 新增-IP或IP區段
router.get(
  "/ip-whitelists",
  authenticated,
  checkBOAdminAccess,
  operateLogger,
  apisControllerV1["BOsearchIPWhitelists"]
) // 查詢-IP與IP區段列表
router.put(
  "/ip-whitelists/:id",
  authenticated,
  checkBOAdminAccess,
  operateLogger,
  apisControllerV1["BOupdateIPWhitelist"]
) // 修改-IP或IP區段
router.delete(
  "/ip-whitelists/:id",
  authenticated,
  checkBOAdminAccess,
  operateLogger,
  apisControllerV1["BOdeleteIPWhitelist"]
) // 刪除-IP或IP區段

// >前台使用者管理
// -註冊
router.post("/register/user", operateLogger, apisControllerV1["registerUser"])
// -驗證信箱
router.post("/verify", operateLogger, apisControllerV1["registerVerify"])
// -登入
router.post("/login", operateLogger, apisControllerV1["login"])
// -登出
router.post("/logout", operateLogger, apisControllerV1.logout)
// -忘記密碼
router.post("/forgot-password", operateLogger, apisControllerV1.forgotPassword)
// -重設密碼
router.post("/reset-password", operateLogger, apisControllerV1.resetPassword)
// -更新密碼
router.post(
  "/update-password",
  authenticated("frontend"),
  operateLogger,
  apisControllerV1.updatePassword
)
// -使用者資訊-查看
router.get(
  "/user-info",
  authenticated("frontend"),
  operateLogger,
  apisControllerV1["getUserInfo"]
)
// -使用者資訊-修改
router.put(
  "/user-info",
  authenticated("frontend"),
  operateLogger,
  apisControllerV1["updateUserInfo"]
)
// -重寄驗證信
router.post("/resend-verify", operateLogger, apisControllerV1["resendVerify"])

router.use(errorHandler)

module.exports = router
