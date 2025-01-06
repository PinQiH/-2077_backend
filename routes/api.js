const express = require("express")
const router = express.Router()
const fileUpload = require("@middleware/fileUpload")
const mediaUpload = require("@middleware/mediaUpload")
const { authenticated } = require("@middleware/auth")
const { checkBOAdminAccess } = require("@middleware/auth")
const { uploadCSV } = require("@middleware/csvUpload")
const operateLogger = require("@middleware/operateLogger")
const { errorHandler } = require("@middleware/errorHandler")
const apisControllerV1 = require("@controllers/apisController")

router.get("/test", operateLogger, apisControllerV1["test"])

// >後台
// -商品管理
// 新增商品
router.post("/admin/products", operateLogger, apisControllerV1["createProduct"])
// 更新商品資訊
router.put(
  "/admin/products/:productId",
  operateLogger,
  apisControllerV1["updateProduct"]
)
// 刪除商品
router.delete(
  "/admin/products/:productId",
  operateLogger,
  apisControllerV1["deleteProduct"]
)
// 列出所有商品
router.get("/admin/products", operateLogger, apisControllerV1["getProducts"])

// -訂單管理
// 新增訂單
router.post("/admin/orders", operateLogger, apisControllerV1["createOrders"])
// 列出所有訂單
router.get("/admin/orders", operateLogger, apisControllerV1["getOrders"])
// 查看訂單詳情
router.get(
  "/admin/orders/:orderId",
  operateLogger,
  apisControllerV1["getOrderDetails"]
)
// 更新訂單
router.put(
  "/admin/orders/:orderId",
  operateLogger,
  apisControllerV1["updateOrder"]
)
// 刪除訂單
router.delete(
  "/admin/orders/:id",
  operateLogger,
  apisControllerV1["deleteOrder"]
)

// -支付管理
// 創建支付請求
router.post("/admin/payments", operateLogger, apisControllerV1["createPayment"])
// 查詢支付狀態
router.get(
  "/admin/payments/:id",
  operateLogger,
  apisControllerV1["getPaymentStatus"]
)

// -報表與統計
// 訂單報表
router.get(
  "/admin/reports/orders",
  operateLogger,
  apisControllerV1["getOrderReport"]
)
// 商品銷售報表
router.get(
  "/admin/reports/products",
  operateLogger,
  apisControllerV1["getProductReport"]
)
// 用戶活躍報表
router.get(
  "/admin/reports/users",
  operateLogger,
  apisControllerV1["getUserReport"]
)

// -系統狀態檢查
// 系統狀態檢查
router.get(
  "/admin/status",
  operateLogger,
  apisControllerV1["checkSystemStatus"]
)

router.use(errorHandler)

module.exports = router
