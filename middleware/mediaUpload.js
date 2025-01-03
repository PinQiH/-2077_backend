const multer = require("multer")
const fs = require("fs")
const path = require("path")
// todo 使用file-type檢驗檔案類型

// 確保目錄存在，如果不存在則創建
function ensureDirSync(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

// 設置 multer 存儲配置
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let uploadPath = "./public/temp" // 預設上傳目錄
    if (file.mimetype.startsWith("image/")) {
      uploadPath = path.join(uploadPath, "image") // 圖片存儲目錄
    } else if (file.mimetype.startsWith("audio/")) {
      uploadPath = path.join(uploadPath, "audio") // 聲音存儲目錄
    }
    ensureDirSync(uploadPath) // 確保目錄存在
    cb(null, uploadPath)
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname)
  },
})

// 檢查檔案是否存在的函數
function checkFileExistsSync(filepath) {
  try {
    fs.accessSync(filepath, fs.constants.F_OK)
    return true
  } catch (e) {
    return false
  }
}

// 檢查檔案格式
function checkFileType(type) {
  try {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "audio/mpeg", // 對於mp3檔案
      "audio/wav", // 對於wav檔案
    ]

    if (!allowedTypes.includes(type)) {
      return false
    } else {
      return true
    }
  } catch (e) {
    return false
  }
}

// 自定義文件篩選器
const fileFilter = (req, file, cb) => {
  let uploadPath = "./public/temp" // 預設上傳目錄
  if (file.mimetype.startsWith("image/")) {
    uploadPath = path.join(uploadPath, "image") // 圖片存儲目錄
  } else if (file.mimetype.startsWith("audio/")) {
    uploadPath = path.join(uploadPath, "audio") // 聲音存儲目錄
  }

  // 檢查檔案類型是否被允許
  if (!checkFileType(file.mimetype)) {
    cb(new Error("不支援的檔案類型"))
  }
  // else if (checkFileExistsSync(path.join(uploadPath, file.originalname))) {
  //   // 檢查檔案是否已存在
  //   cb(new Error("檔名重復，無法上傳"))
  // }
  else if (file.originalname.length > 240) {
    // 檢查檔名長度是否超過240個字符
    cb(new Error("檔名超過最大允許長度（240個字符），無法上傳"))
  } else {
    // 檔案類型被允許且檔名長度合適，接受檔案
    cb(null, true)
  }
}

// 設置 multer 上傳配置，最多可上傳1000張圖片
const upload = multer({ storage: storage, fileFilter: fileFilter }).array(
  "media",
  1000
)

// 定義中間件函數
function mediaUpload(req, res, next) {
  upload(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      // 檢查是否因為文件數量過多引起的錯誤
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return res.status(400).json({
          rtnCode: "0000",
          rtnMsg: "超過上傳數量限制",
          error: err,
        })
      }

      // 處理 multer 特定的錯誤
      return res.status(500).json({
        rtnCode: "0000",
        rtnMsg: "上傳錯誤: " + err.message,
        error: err,
      })
    } else if (err) {
      // 處理其他類型的錯誤
      return res.status(500).json({
        rtnCode: "0000",
        rtnMsg: "發生錯誤: " + err.message,
        error: err,
      })
    }

    // 新增 decodeFileName 欄位
    req.files.forEach((file) => {
      file.decodedFileName = decodeURIComponent(file.originalname)
    })

    // 上傳成功，進入下一個中間件或路由處理器
    next()
  })
}

// 導出 imagesUpload 中間件
module.exports = mediaUpload
