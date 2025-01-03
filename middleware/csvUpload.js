const multer = require("multer")
const { ThirdPartyApiError } = require("@utils/error")
const fs = require("fs")
const fastCSV = require("fast-csv")
const chardet = require("chardet")
const iconv = require("iconv-lite")
const path = require("path")
const XLSX = require("xlsx")
const stream = require("stream")
// todo 使用memory時，在stage環境處理csv檔案會出現亂碼。

// 獨立函數用於轉換 fileData 為 Stream 或 Buffer
async function toBufferOrStream(fileData) {
  return fileData instanceof Buffer ? fileData : fs.promises.readFile(fileData)
}

// XlsxToCsv 轉換函數
async function convertXlsxToCsv(fileData) {
  let buffer = await toBufferOrStream(fileData)
  const workbook = XLSX.read(buffer, { type: "buffer" })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const csvContent = XLSX.utils.sheet_to_csv(sheet)
  return csvContent
}

// 驗證 CSV 檔案格式是否正確
async function isValidCSVPartial(fileData) {
  return new Promise(async (resolve, reject) => {
    let rows = 0
    let buffer = await toBufferOrStream(fileData)
    const readStream =
      buffer instanceof Buffer
        ? stream.Readable.from(buffer)
        : fs.createReadStream(fileData)

    fastCSV
      .parseStream(readStream, { headers: true, maxRows: 5 })
      .on("data", () => rows++)
      .on("end", () => {
        rows > 0
          ? resolve(true)
          : reject(new ThirdPartyApiError("CSV檔案格式錯誤"))
      })
      .on("error", () => {
        reject(new ThirdPartyApiError("CSV檔案格式錯誤"))
      })
  })
}

// Local storage setting
const diskStorage = multer.diskStorage({
  destination: "./public/temp/",
  filename: (req, file, cb) => {
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname)
    )
  },
})

// 檔案過濾器，只允許 CSV 和 XLSX 檔案
const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === "text/csv" ||
    file.mimetype === "application/vnd.ms-excel" ||
    file.mimetype ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    cb(null, true)
  } else {
    cb(new ThirdPartyApiError("檔案只支援CSV,XLSX,XLS"), false)
  }
}

// In-memory storage
const memoryStorage = multer.memoryStorage()

const storageOptions = {
  local: diskStorage,
  memory: memoryStorage,
}

// Choose storage based on environment variable
const chosenStorage = storageOptions[process.env.CSV_STORAGE]

const csvUpload = multer({
  storage: chosenStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 限制文件大小10MB
  },
}).single("csvFile")

async function checkAndConvertEncoding(fileData) {
  let buffer
  if (fileData instanceof Buffer) {
    buffer = fileData
  } else {
    buffer = fs.readFileSync(fileData)
  }

  const detectedEncoding = chardet.detect(buffer)
  if (detectedEncoding !== "UTF-8" && detectedEncoding !== "ASCII") {
    const convertedData = iconv.decode(buffer, detectedEncoding)
    const utf8Buffer = iconv.encode(convertedData, "UTF-8")
    if (!(fileData instanceof Buffer)) {
      fs.writeFileSync(fileData, utf8Buffer)
    }
    return utf8Buffer
  }

  return buffer // 若已是 UTF-8 或 ASCII，則直接返回
}

async function uploadCSV(req, res, next) {
  csvUpload(req, res, async (err) => {
    if (err) {
      return next(new ThirdPartyApiError(err.message))
    }

    if (!req.file) {
      return next(new ThirdPartyApiError("請上傳檔案"))
    }

    try {
      let fileData = req.file.buffer || req.file.path

      // 檢查檔案類型並轉換.xlsx檔案為CSV
      if (
        req.file.mimetype ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      ) {
        const csvData = await convertXlsxToCsv(fileData)
        // 如果是Buffer，則轉換；如果是路徑，則寫入轉換後的數據到一個新檔案
        fileData = Buffer.from(csvData)
        // 更新req.file以反映轉換後的數據
        if (process.env.CSV_STORAGE === "memory") {
          req.file.buffer = fileData
        } else {
          // 可以選擇寫入到原檔案或一個新檔案
          fs.writeFileSync(req.file.path, fileData)
        }
      }

      // 對文件進行編碼檢查和轉換
      const convertedData = await checkAndConvertEncoding(fileData)

      // 使用轉換後的數據進行CSV驗證
      await isValidCSVPartial(convertedData)
      next()
    } catch (error) {
      if (process.env.CSV_STORAGE === "local") {
        fs.unlinkSync(req.file.path) // 清理文件
      }
      return next(new ThirdPartyApiError(error.message))
    }
  })
}

module.exports = {
  uploadCSV,
}
