const express = require("express")
const router = express.Router()
const fileUpload = require("@middleware/fileUpload")
const mediaUpload = require("@middleware/mediaUpload")
const { authenticated } = require("@middleware/auth")
const { checkBOAdminAccess } = require("@middleware/auth")
const { uploadCSV } = require("@middleware/csvUpload")
const operateLogger = require("@middleware/operateLogger")
const { errorHandler } = require("@middleware/errorHandler")
const apisControllerV1 = require("@controllers/inner-apisController")

router.get("/test", operateLogger, apisControllerV1["test"])
router.get(
  "/dbpool-commection-test",
  operateLogger,
  apisControllerV1["dbPoolConnectionTest"]
)
router.get("/update-product", operateLogger, apisControllerV1["updateProduct"])

router.use(errorHandler)

module.exports = router
