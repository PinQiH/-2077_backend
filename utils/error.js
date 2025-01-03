class ValidationError extends Error {
  //這種錯誤類型涉及到用戶輸入或請求中的數據不符合我們的驗證規則。例如，用戶可能提交了一個包含無效電子郵件地址的表單。
  constructor(message) {
    super(message)
    this.name = "ValidationError"
  }
}

class DatabaseConflictError extends Error {
  //這些錯誤發生在用戶嘗試訪問我們應用程序中不存在的資源（如特定的API端點或數據庫紀錄）時。
  constructor(message) {
    super(message)
    this.name = "DatabaseConflictError"
  }
}

class PermissionError extends Error {
  //這些錯誤發生在用戶嘗試訪問他們沒有權限訪問的資源時，例如他們嘗試讀取或寫入他們不應有訪問權限的數據。
  constructor(message) {
    super(message)
    this.name = "PermissionError"
  }
}

class ThirdPartyApiError extends Error {
  //當我們的應用程序與第三方服務交互時，可能會發生這些錯誤。例如，我們可能嘗試從另一個服務中獲取數據，但該服務返回了一個錯誤。
  constructor(message, { data } = {}) {
    super(message)
    this.data = data
    this.name = "ThirdPartyApiError"
  }
}

module.exports = {
  ValidationError,
  DatabaseConflictError,
  PermissionError,
  ThirdPartyApiError,
}
