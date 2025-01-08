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
  "/admin/orders/:orderId",
  operateLogger,
  apisControllerV1["deleteOrder"]
)

// -錢包管理
// 新增支出/收入
router.post(
  "/admin/wallet",
  operateLogger,
  apisControllerV1["createTransaction"]
)
// 刪除支出/收入
router.delete(
  "/admin/wallet/:transactionId",
  operateLogger,
  apisControllerV1["deleteTransaction"]
)
// 列出所有支出/收入
router.get(
  "/admin/wallet",
  operateLogger,
  apisControllerV1["getAllTransactions"]
)
// 結算利潤
router.get(
  "/admin/wallet/profit",
  operateLogger,
  apisControllerV1["calculateProfit"]
)

// -優惠券管理
// 新增優惠券
router.post("/admin/coupons", operateLogger, apisControllerV1["createCoupon"])
// 編輯優惠券
router.put(
  "/admin/coupons/:couponId",
  operateLogger,
  apisControllerV1["updateCoupon"]
)
// 刪除優惠券
router.delete(
  "/admin/coupons/:couponId",
  operateLogger,
  apisControllerV1["deleteCoupon"]
)
// 列出所有優惠券
router.get("/admin/coupons", operateLogger, apisControllerV1["getAllCoupons"])

// -報表與統計
// 總客數
router.get(
  "/admin/reports/customers",
  operateLogger,
  apisControllerV1["getCustomerReport"]
)
// 總營業額
router.get(
  "/admin/reports/revenue",
  operateLogger,
  apisControllerV1["getRevenueReport"]
)
// 連線門檻
router.get(
  "/admin/reports/threshold",
  operateLogger,
  apisControllerV1["getThresholdReport"]
)
// 訂單報表
router.get(
  "/admin/reports/orders",
  operateLogger,
  apisControllerV1["getOrderReport"]
)
// 品牌銷售報表
router.get(
  "/admin/reports/brands",
  operateLogger,
  apisControllerV1["getProductReport"]
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
