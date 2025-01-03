require("dotenv").config()
const db = require("@models")
const repository = require("@repository")
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const {
  ValidationError,
  DatabaseConflictError,
  PermissionError,
  ThirdPartyApiError,
} = require("@utils/error")
const { cfCheck } = require("@utils/cloudFlareTurnstile")
const { sendMail } = require("@utils/emailSender")
const {
  fetchLocalApiData,
  sendLocalApiData,
  deleteLocalApiData,
  modifiedLocalApiData,
} = require("@utils/localApiService")
const { validateInput } = require("@utils/validators")
const { snakeToCamel } = require("@utils/utilHelper")

const isDev = process.env.NODE_ENV === "development"

// 非同步寄信
function sendEmailBackground(to, subject, htmlContent, next) {
  if (Array.isArray(to)) {
    to = to.join(", ")
  }

  const mailOptions = {
    from: process.env.MAIL_AC,
    to: to,
    subject: subject,
    html: htmlContent,
  }
  if (process.env.DEV_CC === "true") {
    mailOptions.bcc = process.env.DEVELOPER_EMAIL
  }
  const isDev = process.env.NODE_ENV === "development"
  const options = {
    MAIL_AC: process.env.MAIL_AC,
    MAIL_PW: process.env.MAIL_PW,
    DEBUG_MODE: isDev,
  }
  // if (!isDev) {
  //   options.PROXY_TYPE = "socks5"
  //   options.TRANSPORTS_PROXY = process.env.TRANSPORTS_PROXY
  // }

  sendMail(mailOptions, options).catch((error) => {
    const err = new ThirdPartyApiError(`Email寄送失敗。 ${error}`)
    return next(err)
  })
}

module.exports = {
  // >後台使用者管理
  // -後台帳號管理 API
  BOlogin: async (req, res, next) => {
    // todo: 取得IP方式有待討論
    const getClientIp = (req) => {
      const xForwardedFor = req.headers["x-forwarded-for"]
      let clientIp
      if (xForwardedFor) {
        const list = xForwardedFor.split(",").map((ip) => ip.trim())
        clientIp = list[0]
      } else {
        clientIp = req.socket.remoteAddress
      }

      // 去除 IPv6 映射的 IPv4 地址前面的 "::ffff:"
      if (clientIp.startsWith("::ffff:")) {
        clientIp = clientIp.replace(/^::ffff:/, "")
      }

      return clientIp
    }
    const genJwtToken = (userData, clientIp) => {
      const jwtSignOptions = userData
      if (process.env.IP_CHECK === "true") jwtSignOptions.clientIp = clientIp
      return jwt.sign(jwtSignOptions, process.env.JWT_SECRET, {
        expiresIn: process.env.TOKEN_EXPIRE_TIME,
      })
    }
    const genCookieOptions = () => {
      const cookieExpireTime =
        process.env.TOKEN_EXPIRE_TIME.slice(0, -1) * 3600000 //tokenExpireTime * 1hr

      return {
        httpOnly: !isDev,
        secure: !isDev,
        sameSite: "strict",
        maxAge: cookieExpireTime,
      }
    }
    const transaction = await db.sequelize.transaction()
    let transactionCommitted = false
    try {
      const { account, password } = validateInput([
        {
          labelName: "帳號",
          inputName: "account",
          inputValue: req.body.account,
          validateWay: "isString",
          patterns: ["^[a-zA-Z0-9_]+$"],
          customMessages: {
            "string.pattern.base": "{#label} 只能包含字母、數字和下劃線",
          },
          isRequired: true,
        },
        {
          labelName: "密碼",
          inputName: "password",
          inputValue: req.body.password,
          validateWay: "password",
          maxLength: 16,
          minLength: 8,
          isRequired: true,
        },
      ])
      const clientIp = getClientIp(req)

      const ipWhiteListSetting = await repository.settingsRepo.getSetting(
        "IPWhiteList"
      )

      if (ipWhiteListSetting === "Y") {
        const checkPass = await repository.ipWhitelistsRepo.isIpWhitelisted(
          clientIp
        )
        if (!checkPass) {
          await repository.backendLoginHistoriesRepo.createBackendUserLoginHistory(
            {
              account,
              loginStatus: 2, // IP 沒有在白名單時的狀態
              ipAddress: clientIp,
            },
            transaction
          )

          await transaction.commit()
          transactionCommitted = true

          return res.status(200).json({
            rtnCode: "0001",
            rtnMsg: "您的IP違反白名單限制，請連絡後台管理員",
          })
        }
      }

      const isUserExist =
        await repository.backendUsersRepo.doesBackendUserAccountExist(account)

      if (!isUserExist) {
        throw new ValidationError("帳號或密碼錯誤")
      }

      const userData = snakeToCamel(isUserExist.get({ plain: true }))

      if (userData.accountStatus === 1) {
        // 創建登入失敗紀錄
        await repository.backendLoginHistoriesRepo.createBackendUserLoginHistory(
          {
            account,
            loginStatus: 1,
            ipAddress: clientIp,
          },
          transaction
        )

        await transaction.commit()
        transactionCommitted = true

        return res.status(200).json({
          rtnCode: "0002",
          rtnMsg: "此信箱尚未完成驗證",
        })
      }

      const isPasswordMatch = await bcrypt.compare(password, userData.password)

      if (!isPasswordMatch) {
        await repository.backendLoginHistoriesRepo.createBackendUserLoginHistory(
          {
            account,
            loginStatus: 1,
            ipAddress: clientIp,
          },
          transaction
        )
        await transaction.commit()
        transactionCommitted = true

        return res.status(200).json({
          rtnCode: "0003",
          rtnMsg: "帳號或密碼錯誤",
        })
      }

      const lastTimeLogin =
        await repository.backendLoginHistoriesRepo.findBackendUserLoginHistories(
          { account, limit: 1 }
        )

      await repository.backendLoginHistoriesRepo.createBackendUserLoginHistory(
        {
          account,
          loginStatus: 0,
          ipAddress: clientIp,
        },
        transaction
      )

      // 移除敏感資料
      delete userData.password

      // 加入上次登入時間
      userData.lastTimeLogin = lastTimeLogin[0]?.createdAt || null

      const token = genJwtToken(userData, clientIp)

      const cookieOptions = genCookieOptions()

      // 透過userAccount找到該user的role(可能有多個)
      const userRoles = await repository.userRolesRepo.getUserRoles(account)
      const roleIds = userRoles.map((role) => role.role_id)

      // 利用這些角色，搜尋具有的權限，且permission_type是page
      const pagePermissions =
        await repository.rolePermissionsRepo.getRolePermissionsById(roleIds)

      // 加入權限資料到返回的用戶資料中
      // 確保在設定權限之前pagePermissions不是null
      if (
        pagePermissions &&
        Object.keys(pagePermissions.permissions).length > 0
      ) {
        userData.permissions = pagePermissions.permissions
      } else {
        // 如果pagePermissions是null，則設置一個空數組或其他預設值
        userData.permissions = [] // 或其他合適的預設值
      }

      await transaction.commit()
      transactionCommitted = true

      return res
        .cookie("backendAccessToken", token, cookieOptions)
        .status(200)
        .json({
          rtnCode: "0000",
          rtnMsg: "登入成功",
          data: isDev ? { token, userData } : { userData },
        })
    } catch (err) {
      if (!transactionCommitted) {
        // 只有當交易尚未提交時才回滾
        await transaction.rollback()
      }
      err.code = "LOGIN_ERROR"
      next(err)
    }
  },
  BOlogout: async (req, res) => {
    const cookieExpireTime = 0 // 設定過期時間為 0，立即使 cookie 失效

    const cookieOptions = {
      httpOnly: !isDev,
      secure: !isDev,
      sameSite: "strict",
      maxAge: cookieExpireTime,
    }

    res.cookie("backendAccessToken", "", cookieOptions) // 清除 cookie
    res.status(200).json({
      rtnCode: "0000",
      rtnMsg: "登出成功",
    })
  },
  BOgetPermissionByPage: async (req, res, next) => {
    const transaction = await db.sequelize.transaction()
    let transactionCommitted = false
    try {
      const { userAccount } = req.body
      const { pageId } = req.params

      // 驗證過程
      const validatedData = validateInput([
        {
          labelName: "使用者帳號",
          inputName: "userAccount",
          inputValue: userAccount,
          validateWay: "isString",
          isRequired: true,
        },
        {
          labelName: "頁面ID",
          inputName: "pageId",
          inputValue: pageId,
          validateWay: "isNumber",
          isRequired: true,
        },
      ])

      // 透過userAccount找到該user的role(可能有多個)
      const userRoles = await repository.userRolesRepo.getUserRoles(
        validatedData.userAccount,
        transaction
      )
      const roleIds = userRoles.map((role) => role.role_id)

      // 透過role找到相關permission
      const rolePermissions =
        await repository.rolePermissionsRepo.getChildRolePermissionsById(
          roleIds,
          validatedData.pageId,
          transaction
        )

      await transaction.commit()
      transactionCommitted = true

      // 將查詢結果格式化
      const formattedPermissions = rolePermissions.map((permission) => {
        return {
          permissionId: permission["Permission.permission_id"],
          permissionName: permission["Permission.permission_name"],
          permissionSequence: permission["Permission.permission_sequence"],
          permissionType: permission["Permission.permission_type"],
        }
      })

      return res.json({
        rtnCode: "0000",
        rtnMsg: "成功取得使用者頁面按鈕權限清單",
        data: {
          permissions: formattedPermissions,
        },
      })
    } catch (err) {
      if (!transactionCommitted) {
        // 只有當交易尚未提交時才回滾
        await transaction.rollback()
      }
      err.code = "getPageBtnPermission_ERROR"
      next(err)
    }
  },
  BOgetBackendUsersList: async (req, res, next) => {
    const transaction = await db.sequelize.transaction()
    let transactionCommitted = false
    try {
      // 解析查詢參數
      let {
        username,
        createdAtStart,
        createdAtEnd,
        creator,
        updatedAtStart,
        updatedAtEnd,
        editor,
        roleIds,
        status,
        page = 1,
        pageSize = 10,
        sortBy = "updatedAt",
        sortDirection = "DESC",
      } = req.query

      if (roleIds) {
        roleIds = JSON.parse(roleIds)
      }

      // 驗證參數
      const validatedData = validateInput([
        {
          labelName: "建立時間(起)",
          inputName: "createdAtStart",
          inputValue: createdAtStart,
          validateWay: "isDate",
          isRequired: false,
        },
        {
          labelName: "建立時間(訖)",
          inputName: "createdAtEnd",
          inputValue: createdAtEnd,
          validateWay: "isDate",
          isRequired: false,
        },
        {
          labelName: "修改時間(起)",
          inputName: "updatedAtStart",
          inputValue: updatedAtStart,
          validateWay: "isDate",
          isRequired: false,
        },
        {
          labelName: "修改時間(訖)",
          inputName: "updatedAtEnd",
          inputValue: updatedAtEnd,
          validateWay: "isDate",
          isRequired: false,
        },
        {
          labelName: "使用者帳號",
          inputName: "username",
          inputValue: username,
          validateWay: "isString",
          isRequired: false,
        },
        {
          labelName: "狀態",
          inputName: "status",
          inputValue: status,
          validateWay: "isNumber",
          isRequired: false,
        },
        {
          labelName: "建立者",
          inputName: "creator",
          inputValue: creator,
          validateWay: "isString",
          isRequired: false,
        },
        {
          labelName: "修改者",
          inputName: "editor",
          inputValue: editor,
          validateWay: "isString",
          isRequired: false,
        },
        {
          labelName: "角色",
          inputName: "roleIds",
          inputValue: roleIds,
          validateWay: "isArray",
          isRequired: false,
        },
        {
          labelName: "每頁數量",
          inputName: "pageSize",
          inputValue: pageSize,
          validateWay: "isNumber",
          isRequired: false,
        },
        {
          labelName: "頁碼",
          inputName: "page",
          inputValue: page,
          validateWay: "isNumber",
          isRequired: false,
        },
        {
          labelName: "排序欄位",
          inputName: "sortBy",
          inputValue: sortBy,
          validateWay: "isString",
          isRequired: false,
        },
        {
          labelName: "排序方向",
          inputName: "sortDirection",
          inputValue: sortDirection,
          validateWay: "isString",
          toUpperCase: true,
          isRequired: false,
        },
      ])

      // 解析分頁參數
      const currentPage = parseInt(validatedData.page, 10) || 1
      const currentPageSize = parseInt(validatedData.pageSize, 10) || 10

      // 進行查詢
      const { result, totalCount } =
        await repository.backendUsersRepo.findAndCountAllUsers(
          validatedData,
          currentPageSize,
          currentPage,
          transaction
        )

      await transaction.commit()
      transactionCommitted = true

      const totalPages = Math.ceil(totalCount / currentPageSize)
      if (totalPages == 0) {
        return res.status(200).json({ rtnCode: "0001", rtnMsg: "查無結果" })
      }

      // 格式化用戶數據
      const formattedUsers = result.rows.map((user) => {
        const roles = user.User_Roles.map((userRole) => ({
          roleId: userRole.Role.role_id,
          roleName: userRole.Role.role_name,
        }))

        return {
          backendUserAccount: user.backend_user_account,
          createdAt: user.createdAt,
          creator: user.creator,
          updatedAt: user.updatedAt,
          editor: user.editor,
          accountStatus: user.account_status,
          Roles: roles,
        }
      })

      // 返回結果包含分頁信息
      const responseData = {
        rtnCode: "0000",
        rtnMsg: "搜尋成功",
        data: snakeToCamel(formattedUsers),
        pagination: {
          page: currentPage,
          perPage: currentPageSize,
          totalPages: totalPages,
          totalCount: totalCount,
        },
      }

      return res.status(200).json(responseData)
    } catch (err) {
      if (!transactionCommitted) {
        // 只有當交易尚未提交時才回滾
        await transaction.rollback()
      }
      err.code = "GET_BACKEND_USERS_LIST_ERROR"
      next(err)
    }
  },
  BOgetActiveRoles: async (req, res, next) => {
    const transaction = await db.sequelize.transaction()
    let transactionCommitted = false
    try {
      const roles = await repository.rolesRepo.findActiveRoles(transaction)

      await transaction.commit()
      transactionCommitted = true

      const formattedData = roles.map((role) => ({
        roleId: role.role_id,
        roleName: role.role_name,
      }))

      const responseData = {
        rtnCode: "0000",
        rtnMsg: "成功列出角色",
        data: snakeToCamel(formattedData),
      }

      return res.status(200).json(snakeToCamel(responseData))
    } catch (err) {
      if (!transactionCommitted) {
        // 只有當交易尚未提交時才回滾
        await transaction.rollback()
      }
      err.code = "GET_ACTIVE_ROLES_ERROR"
      next(err)
    }
  },
  BOcreateBackendUser: async (req, res, next) => {
    const transaction = await db.sequelize.transaction()
    let transactionCommitted = false
    try {
      // 從請求體中接收資料
      const { backendUserAccount, email, password, roles, status } = req.body

      // 驗證過程
      const validatedData = validateInput([
        {
          labelName: "使用者帳號",
          inputName: "backendUserAccount",
          inputValue: backendUserAccount,
          validateWay: "isString",
          isRequired: true,
        },
        {
          labelName: "Email",
          inputName: "email",
          inputValue: email,
          validateWay: "isString",
          isRequired: true,
        },
        {
          labelName: "使用者密碼",
          inputName: "password",
          inputValue: password,
          validateWay: "password",
          isRequired: true,
        },
        {
          labelName: "角色",
          inputName: "roles",
          inputValue: roles,
          validateWay: "isArray",
          isRequired: true,
        },
        {
          labelName: "狀態",
          inputName: "status",
          inputValue: status,
          validateWay: "isNumber",
          isRequired: true,
        },
      ])

      // 檢查 backendUserAccount 是否已經存在於資料庫中
      const accountExists =
        await repository.backendUsersRepo.doesBackendUserAccountExist(
          validatedData.backendUserAccount,
          transaction
        )

      if (accountExists) {
        await transaction.commit()
        transactionCommitted = true

        return res.status(200).json({
          rtnCode: "0001",
          rtnMsg: "後台使用者帳號已經存在",
        })
      }

      // 取得creator
      const creator = req.user.email

      // 將密碼加密
      const saltRounds = await bcrypt.genSalt(10)
      const hashedPassword = await bcrypt.hash(
        validatedData.password,
        saltRounds
      )

      // 創建使用者資料
      const userData = {
        backend_user_account: validatedData.backendUserAccount,
        status: validatedData.status,
        email: validatedData.email,
        password: hashedPassword,
        creator: creator,
        editor: creator,
      }
      await repository.backendUsersRepo.createUser(userData, transaction)

      // 綁定使用者角色
      for (const roleId of validatedData.roles) {
        await repository.userRolesRepo.createUserRoles(
          validatedData.backendUserAccount,
          roleId,
          creator,
          transaction
        )
      }

      await transaction.commit()
      transactionCommitted = true

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "後台使用者新增成功",
      })
    } catch (err) {
      err.code = "CREATE_BACKEND_USER_ERROR"
      if (!transactionCommitted) {
        // 只有當交易尚未提交時才回滾
        await transaction.rollback()
      }
      next(err)
    }
  },
  BOupdateBackendUser: async (req, res, next) => {
    const transaction = await db.sequelize.transaction()
    let transactionCommitted = false
    try {
      // 從請求體中接收資料
      const { backendUserAccount, email, roles, status } = req.body

      // 驗證過程
      const validatedData = validateInput([
        {
          labelName: "使用者帳號",
          inputName: "backendUserAccount",
          inputValue: backendUserAccount,
          validateWay: "isString",
          isRequired: true,
        },
        {
          labelName: "Email",
          inputName: "email",
          inputValue: email,
          validateWay: "isString",
          isRequired: false,
        },
        {
          labelName: "角色",
          inputName: "roles",
          inputValue: roles,
          validateWay: "isArray",
          isRequired: false,
        },
        {
          labelName: "狀態",
          inputName: "status",
          inputValue: status,
          validateWay: "isNumber",
          isRequired: false,
        },
      ])

      // 取得當前使用者帳號
      const user = req.user.email

      // 檢查使用者帳號是否存在
      const userExists =
        await repository.backendUsersRepo.doesBackendUserAccountExist(
          validatedData.backendUserAccount,
          transaction
        )
      if (!userExists) {
        await transaction.commit()
        transactionCommitted = true

        return res.status(200).json({
          rtnCode: "0001",
          rtnMsg: "後台使用者帳號不存在",
        })
      }

      // 更新基本資料
      if (
        typeof validatedData.email !== "undefined" ||
        typeof validatedData.status !== "undefined"
      ) {
        await repository.backendUsersRepo.updateBackendUser(
          validatedData.backendUserAccount,
          validatedData.email,
          validatedData.status,
          user,
          transaction
        )
      }

      // 更新使用者角色
      if (validatedData.roles) {
        await repository.userRolesRepo.distroyUserRoles(
          validatedData.backendUserAccount,
          transaction
        )

        // 綁定使用者角色
        for (const roleId of validatedData.roles) {
          await repository.userRolesRepo.createUserRoles(
            validatedData.backendUserAccount,
            roleId,
            user,
            transaction
          )
        }
      }

      await transaction.commit()
      transactionCommitted = true

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "後台使用者更新成功",
      })
    } catch (err) {
      // 如果過程中捕捉到異常，則使用下面的錯誤代碼和信息
      err.code = "UPDATE_BACKEND_USER_ERROR"
      if (!transactionCommitted) {
        // 只有當交易尚未提交時才回滾
        await transaction.rollback()
      }
      next(err)
    }
  },
  BOchangeUserPassword: async (req, res, next) => {
    const transaction = await db.sequelize.transaction()
    let transactionCommitted = false
    try {
      const { userAccount, newPassword } = req.body

      // 驗證過程
      const validatedData = validateInput([
        {
          labelName: "使用者帳號",
          inputName: "userAccount",
          inputValue: userAccount,
          validateWay: "isString",
          isRequired: true,
        },
        {
          labelName: "新密碼",
          inputName: "newPassword",
          inputValue: newPassword,
          validateWay: "password",
          isRequired: true,
        },
      ])

      // 將密碼加密
      const saltRounds = await bcrypt.genSalt(10)
      const hashedPassword = await bcrypt.hash(
        validatedData.newPassword,
        saltRounds
      )

      // 取得當前使用者帳號
      const user = req.user.email

      // 更新密碼
      const isPasswordChanged =
        await repository.backendUsersRepo.updatePassword(
          validatedData.userAccount,
          hashedPassword,
          user,
          transaction
        )

      await transaction.commit()
      transactionCommitted = true

      if (isPasswordChanged) {
        return res.status(200).json({
          rtnCode: "0000",
          rtnMsg: "密碼修改成功",
        })
      } else {
        return res.status(200).json({
          rtnCode: "0002",
          rtnMsg: "密碼修改失敗，請稍後再試",
        })
      }
    } catch (err) {
      if (!transactionCommitted) {
        // 只有當交易尚未提交時才回滾
        await transaction.rollback()
      }
      err.code = "CHANGE_PASSWORD_ERROR"
      next(err)
    }
  },
  BOtoggleUserStatus: async (req, res, next) => {
    const transaction = await db.sequelize.transaction()
    let transactionCommitted = false
    try {
      const userAccount = req.body.userAccount

      // 驗證參數
      const validatedData = validateInput([
        {
          labelName: "使用者帳號",
          inputName: "userAccount",
          inputValue: userAccount,
          validateWay: "isString",
          isRequired: true,
        },
      ])

      // 從資料操作層獲取使用者目前狀態
      const user =
        await repository.backendUsersRepo.doesBackendUserAccountExist(
          validatedData.userAccount,
          transaction
        )
      if (!user) {
        await transaction.commit()
        transactionCommitted = true

        return res.status(200).json({
          rtnCode: "0002",
          rtnMsg: "使用者不存在",
        })
      }

      // 切換狀態：如果當前為啟用（0），則禁用（1），反之亦然
      const newStatus = user.account_status === 0 ? 1 : 0

      // 取得當前使用者帳號
      const editor = req.user.email

      // 更新使用者狀態
      const isStatusUpdated =
        await repository.backendUsersRepo.updateUserStatus(
          validatedData.userAccount,
          newStatus,
          editor,
          transaction
        )

      await transaction.commit()
      transactionCommitted = true

      if (isStatusUpdated) {
        return res.status(200).json({
          rtnCode: "0000",
          rtnMsg: "使用者狀態更新成功",
        })
      } else {
        return res.status(200).json({
          rtnCode: "0001",
          rtnMsg: "使用者狀態更新失敗",
        })
      }
    } catch (err) {
      if (!transactionCommitted) {
        // 只有當交易尚未提交時才回滾
        await transaction.rollback()
      }
      err.code = "TOGGLE_USER_STATUS_ERROR"
      next(err)
    }
  },
  BOvalidateBOAdminPassword: async (req, res, next) => {
    const transaction = await db.sequelize.transaction()
    let transactionCommitted = false
    try {
      // 從請求體中取得密碼
      const inputPassword = req.body.password

      // 驗證過程
      const validatedData = validateInput([
        {
          labelName: "密碼",
          inputName: "inputPassword",
          inputValue: inputPassword,
          validateWay: "isString",
          isRequired: true,
        },
      ])

      // 取得當前使用者帳號
      const user = req.user.email
      const userData =
        await repository.backendUsersRepo.doesBackendUserAccountExist(
          user,
          transaction
        )
      if (userData.account_status != -1) {
        await transaction.commit()
        transactionCommitted = true

        return res.status(200).json({
          rtnCode: "0001",
          rtnMsg: "權限不符",
        })
      }

      // 取得正確密碼
      const BOAdmin =
        await repository.backendUsersRepo.doesBackendUserAccountExist(
          user,
          transaction
        )
      if (!BOAdmin) {
        await transaction.commit()
        transactionCommitted = true

        return res.status(200).json({
          rtnCode: "0002",
          rtnMsg: "未找到 BOAdmin 帳號",
        })
      }

      await transaction.commit()
      transactionCommitted = true

      // 密碼比對
      const passwordMatch = await bcrypt.compare(
        validatedData.inputPassword,
        BOAdmin.password
      )

      if (passwordMatch) {
        return res.status(200).json({
          rtnCode: "0000",
          rtnMsg: "密碼驗證成功",
        })
      } else {
        return res.status(200).json({
          rtnCode: "0003",
          rtnMsg: "密碼驗證失敗",
        })
      }
    } catch (err) {
      if (!transactionCommitted) {
        // 只有當交易尚未提交時才回滾
        await transaction.rollback()
      }
      err.code = "VALIDATE_BOADMIN_PASSWORD_ERROR"
      next(err)
    }
  },
  BOgetBackendUsersDropdown: async (req, res, next) => {
    const transaction = await db.sequelize.transaction()
    let transactionCommitted = false
    try {
      const users = await repository.backendUsersRepo.getUsersWithStatusZero(
        transaction
      )

      await transaction.commit()
      transactionCommitted = true

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "查詢成功",
        data: users,
      })
    } catch (err) {
      if (!transactionCommitted) {
        // 只有當交易尚未提交時才回滾
        await transaction.rollback()
      }
      err.code = "GET_BACKEND_USERS_DROPDOWN_ERROR"
      next(err)
    }
  },
  BOgetBackendUsersInfo: async (req, res, next) => {
    const transaction = await db.sequelize.transaction()
    let transactionCommitted = false
    try {
      // 從請求體中接收資料
      const { backendUserAccount } = req.body

      // 驗證過程
      const validatedData = validateInput([
        {
          labelName: "使用者帳號",
          inputName: "backendUserAccount",
          inputValue: backendUserAccount,
          validateWay: "isString",
          isRequired: true,
        },
      ])

      const userInfo = await repository.backendUsersRepo.getAccountInfo(
        validatedData.backendUserAccount,
        transaction
      )

      await transaction.commit()
      transactionCommitted = true

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "成功回傳使用者資料",
        data: userInfo,
      })
    } catch (err) {
      if (!transactionCommitted) {
        // 只有當交易尚未提交時才回滾
        await transaction.rollback()
      }
      err.code = "GET_BACKEND_USERS_INFO_ERROR"
      next(err)
    }
  },
  // -前台會員管理 API
  listMembers: async (req, res, next) => {
    try {
      // @接收參數
      let {
        page = 1,
        size = 10,
        sortField = "createdAt",
        sortOrder = "DESC",
        registeredAtStart, // 註冊日期(起)
        registeredAtEnd, // 註冊日期(迄)
        username, // 帳號
        contactPersonName, // 聯絡人名稱
        contactPersonDepartment, // 聯絡人部門
        contactPersonPosition, // 聯絡人職稱
        status, // 狀態
      } = req.query

      // @驗證參數
      validateInput([
        {
          labelName: "註冊日期(起)",
          inputName: "registeredAtStart",
          inputValue: registeredAtStart,
          validateWay: "isDate",
          isRequired: false,
        },
        {
          labelName: "註冊日期(迄)",
          inputName: "registeredAtEnd",
          inputValue: registeredAtEnd,
          validateWay: "isDate",
          isRequired: false,
        },
        {
          labelName: "帳號",
          inputName: "username",
          inputValue: username,
          validateWay: "isString",
          isRequired: false,
        },
        {
          labelName: "聯絡人名稱",
          inputName: "contactPersonName",
          inputValue: contactPersonName,
          validateWay: "isString",
          isRequired: false,
        },
        {
          labelName: "聯絡人部門",
          inputName: "contactPersonDepartment",
          inputValue: contactPersonDepartment,
          validateWay: "isString",
          isRequired: false,
        },
        {
          labelName: "聯絡人職稱",
          inputName: "contactPersonPosition",
          inputValue: contactPersonPosition,
          validateWay: "isString",
          isRequired: false,
        },
        {
          labelName: "每頁數量",
          inputName: "size",
          inputValue: size,
          validateWay: "isNumber",
          isRequired: false,
        },
        {
          labelName: "頁碼",
          inputName: "page",
          inputValue: page,
          validateWay: "isNumber",
          isRequired: false,
        },
        {
          labelName: "排序欄位",
          inputName: "sortField",
          inputValue: sortField,
          validateWay: "isString",
          isRequired: false,
        },
        {
          labelName: "排序方向",
          inputName: "sortOrder",
          inputValue: sortOrder,
          validateWay: "isString",
          toUpperCase: true,
          isRequired: false,
        },
        {
          labelName: "狀態",
          inputName: "status",
          inputValue: status,
          validateWay: "isNumber",
          isRequired: false,
        },
      ])

      // @搜尋
      const { count, rows, totalPages } =
        await repository.frontendUsersRepo.listMembers({
          page,
          size,
          sortField,
          sortOrder,
          registeredAtStart, // 註冊日期(起)
          registeredAtEnd, // 註冊日期(迄)
          username, // 帳號
          contactPersonName, // 聯絡人名稱
          contactPersonDepartment, // 聯絡人部門
          contactPersonPosition, // 聯絡人職稱
          status, // 狀態
        })
      if (count === 0) {
        return res.status(200).json({
          rtnCode: "0001",
          rtnMsg: "沒有符合的資料，請重新搜尋。",
        })
      }

      // @格式化輸出
      const formattedRows = rows.map((user) => {
        const userProfile = user.UserProfiles[0]
          ? user.UserProfiles[0].get({ plain: true })
          : {}
        return {
          userId: user.user_id,
          username: user.username,
          accountStatus: user.account_status,
          createdAt: user.createdAt,
          contactPersonName: userProfile.contact_person_name || null,
          contactPhoneMobile: userProfile.contact_phone_mobile || null,
          contactDepartment: userProfile.contact_department || null,
          contactPosition: userProfile.contact_position || null,
          contactEmail: userProfile.contact_email || null,
        }
      })

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "會員列表獲取成功。",
        data: formattedRows || [],
        pagination: {
          page: parseInt(page),
          perPage: parseInt(size),
          totalPages,
          totalCount: count,
        },
      })
    } catch (err) {
      err.code = "LIST_MEMBERS_ERROR"
      next(err)
    }
  },
  getMember: async (req, res, next) => {
    try {
      // @接收參數
      const userId = req.params.userId

      // @驗證參數
      validateInput([
        {
          labelName: "前台會員ID",
          inputName: "userId",
          inputValue: userId,
          validateWay: "isNumber",
          isRequired: true,
        },
      ])

      // @查詢會員數據
      const user = await repository.frontendUsersRepo.findFrontendUserById(
        userId
      )
      if (!user) {
        return res.status(200).json({
          rtnCode: "0001",
          rtnMsg: "會員未找到",
        })
      }

      // @查詢最近一次修改密碼的時間
      const passwordHistory =
        await repository.frontendPasswordHistoriesRepo.findPasswordHistoriesByUserId(
          userId
        )
      const lastPasswordChange =
        passwordHistory.length > 0 ? passwordHistory[0].date : "沒有修改過密碼"

      // @格式化輸出
      const formattedUser = {
        userId: user.user_id,
        username: user.username,
        accountStatus: user.account_status,
        lastPasswordChange: lastPasswordChange,
        contact: {
          contactPersonName: user.UserProfiles[0].contact_person_name,
          contactPhoneOffice: user.UserProfiles[0].contact_phone_office,
          contactPhoneMobile: user.UserProfiles[0].contact_phone_mobile,
          contactDepartment: user.UserProfiles[0].contact_department,
          contactPosition: user.UserProfiles[0].contact_position,
          contactEmail: user.UserProfiles[0].contact_email,
        },
      }

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "會員查詢成功",
        data: formattedUser, // 這裡返回單一會員數據
      })
    } catch (err) {
      err.code = "GET_MEMBER_ERROR"
      next(err)
    }
  },
  createMember: async (req, res, next) => {
    const transaction = await db.sequelize.transaction()
    let transactionCommitted = false
    try {
      // @接收參數
      const {
        username, // 帳號
        contactPersonName, // 聯絡人姓名
        contactPhoneOffice, // 聯絡人電話
        contactPhoneMobile, // 聯絡人手機
        contactEmail, // 聯絡人電子信箱
        contactDepartment, // 聯絡人部門
        contactPosition, // 聯絡人職稱
      } = req.body

      // @驗證輸入
      validateInput([
        {
          labelName: "帳號",
          inputName: "username",
          inputValue: username,
          validateWay: "isString",
          isRequired: true,
        },
        {
          labelName: "聯絡人姓名",
          inputName: "contactPersonName",
          inputValue: contactPersonName,
          validateWay: "isString",
          isRequired: true,
        },
        {
          labelName: "聯絡人電話",
          inputName: "contactPhoneOffice",
          inputValue: contactPhoneOffice,
          validateWay: "isString",
          isRequired: true,
        },
        {
          labelName: "聯絡人手機",
          inputName: "contactPhoneMobile",
          inputValue: contactPhoneMobile,
          validateWay: "isString",
          isRequired: true,
        },
        {
          labelName: "聯絡人Email",
          inputName: "contactEmail",
          inputValue: contactEmail,
          validateWay: "email",
          isRequired: true,
        },
        {
          labelName: "聯絡人部門",
          inputName: "contactDepartment",
          inputValue: contactDepartment,
          validateWay: "isString",
          isRequired: true,
        },
        {
          labelName: "聯絡人職稱",
          inputName: "contactPosition",
          inputValue: contactPosition,
          validateWay: "isString",
          isRequired: true,
        },
      ])

      // @檢驗 username, email 註冊狀況
      const userData = await repository.frontendUsersRepo.usernameUnique({
        username: username,
        transaction: transaction,
      })
      const emailData = await repository.userProfilesRepo.findUserProfiles(
        { contact_email: contactEmail },
        transaction
      )

      if (userData && userData.account_status === 0) {
        await transaction.commit()
        transactionCommitted = true
        if (Array.isArray(emailData) && emailData.length > 0) {
          return res.status(200).json({
            rtnCode: "0001",
            rtnMsg:
              "此帳號已註冊，請輸入其他帳號名稱。<br>此聯絡人電子信箱已註冊，請輸入其他電子信箱。",
          })
        }
        return res.status(200).json({
          rtnCode: "0001",
          rtnMsg: "此帳號已註冊，請輸入其他帳號名稱。",
        })
      } else if (userData && userData.account_status === -1) {
        await transaction.commit()
        transactionCommitted = true
        if (Array.isArray(emailData) && emailData.length > 0) {
          return res.status(200).json({
            rtnCode: "0001",
            rtnMsg:
              "此帳號已被禁止使用，請輸入其他帳號名稱。<br>此聯絡人電子信箱已註冊，請輸入其他電子信箱。",
          })
        }
        return res.status(200).json({
          rtnCode: "0001",
          rtnMsg: "此帳號已被禁止使用，請輸入其他帳號名稱。",
        })
      } else if (userData && userData.account_status === 1) {
        await transaction.commit()
        transactionCommitted = true
        if (Array.isArray(emailData) && emailData.length > 0) {
          return res.status(200).json({
            rtnCode: "0001",
            rtnMsg:
              "此帳號已註冊，請等待後台管理員審核或至聯絡信箱驗證。<br>此聯絡人電子信箱已註冊，請輸入其他電子信箱。",
          })
        }
        return res.status(200).json({
          rtnCode: "0001",
          rtnMsg: "此帳號已註冊，請等待後台管理員審核或至聯絡信箱驗證。",
        })
      }
      if (Array.isArray(emailData) && emailData.length > 0) {
        return res.status(200).json({
          rtnCode: "0001",
          rtnMsg: "此聯絡人電子信箱已註冊，請輸入其他電子信箱。",
        })
      }

      // @寫入註冊資料
      // 創建用戶
      const randomPassword = crypto.randomBytes(8).toString("hex")
      const newUserData = {
        username,
        password_hash: await bcrypt.hash(randomPassword, 10),
        account_status: 0, // 直接啟用
      }
      const userCreationResult =
        await repository.frontendUsersRepo.createFrontendUser(
          newUserData,
          transaction
        )

      // 創建用戶詳細資料
      const userProfileData = {
        user_id: userCreationResult.user_id,
        contact_person_name: contactPersonName,
        contact_phone_office: contactPhoneOffice,
        contact_phone_mobile: contactPhoneMobile,
        contact_department: contactDepartment,
        contact_position: contactPosition,
        contact_email: contactEmail,
      }
      await repository.userProfilesRepo.createUserProfile(
        userProfileData,
        transaction
      )

      // @儲存驗證碼資訊
      const token = crypto.randomUUID()
      const expireAt = getLaterDate(new Date(), 1, "hour")
      await repository.verifyLinksRepo.createVerificationLink(
        {
          username,
          token,
          statusCode: 0, // active
          expireAt,
        },
        transaction
      )

      // @寫異動紀錄
      const editor = req.user.email // 假設從 req.user 獲取操作者資訊
      const changeLogData = {
        action_type: "create", // 操作類型
        user_id: userCreationResult.user_id,
        editor: editor,
        changes: req.body, // 變更的資料
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await repository.frontendUserLogsRepo.createFrontendUserLog(
        changeLogData,
        transaction
      )

      // @寄信通知該會員修改密碼
      const link =
        process.env.SERVICE_HOST_FRONTEND + "/resetpassword?token=" + token
      const htmlContent = `
        <p>${username} 您好</p>
        <h2 style="color: #007bff;">您的帳號已成功建立！</h2>
        <p>請點擊下方連結，<strong>立即重設您的密碼</strong>，以確保帳號安全：</p>
        <h2><a href="${link}" style="color: #ff0000;">點擊這裡重設您的密碼</a></h2>
        <p>此連結將於 <strong>${expireAt.toLocaleString("zh-TW", {
          timeZone: "Asia/Taipei",
        })}</strong> 後失效，請您儘速重設密碼。</p>

        <hr>

        <h3>以下是您的帳號資訊：</h3>
        <ul>
          <li><strong>帳號：</strong> ${username}</li>
          <li><strong>聯絡人姓名：</strong> ${contactPersonName}</li>
          <li><strong>聯絡人電話：</strong> ${contactPhoneOffice}</li>
          <li><strong>聯絡人手機：</strong> ${contactPhoneMobile}</li>
          <li><strong>聯絡人部門：</strong> ${contactDepartment}</li>
          <li><strong>聯絡人職稱：</strong> ${contactPosition}</li>
        </ul>

        <p>如您發現帳號資訊有誤，請登入<a href="${
          process.env.SERVICE_HOST_FRONTEND
        }">系統</a>後進入個人資料頁面進行修改。</p>

        <hr>

        <p>如果您有任何疑問或需要協助，請聯繫金管會窗口，聯絡資訊如下：</p>
        ${fscContactInfo}
        
        <p>感謝您的配合！</p>
      `
      sendEmailBackground(
        contactEmail,
        `${process.env.SERVICE_NAME}帳號建立成功`,
        htmlContent,
        next
      )

      await transaction.commit()
      transactionCommitted = true

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "會員新增成功。",
      })
    } catch (err) {
      if (!transactionCommitted) {
        // 只有當交易尚未提交時才回滾
        await transaction.rollback()
      }
      err.code = "CREATE_MEMBER_ERROR"
      next(err)
    }
  },
  updateMember: async (req, res, next) => {
    const transaction = await db.sequelize.transaction()
    let transactionCommitted = false
    try {
      // @接收參數
      const {
        userId,
        contactPersonName, // 聯絡人姓名
        contactPhoneOffice, // 公務電話
        contactPhoneMobile, // 公務手機
        contactDepartment, // 聯絡人部門
        contactPosition, // 聯絡人職稱
        contactEmail, // 電子信箱
      } = req.body

      // @驗證參數
      validateInput([
        {
          labelName: "使用者ID",
          inputName: "userId",
          inputValue: userId,
          validateWay: "isNumber",
          isRequired: true,
        },
        {
          labelName: "聯絡人姓名",
          inputName: "contactPersonName",
          inputValue: contactPersonName,
          validateWay: "isString",
          isRequired: false,
        },
        {
          labelName: "公務電話",
          inputName: "contactPhoneOffice",
          inputValue: contactPhoneOffice,
          validateWay: "isString",
          isRequired: false,
        },
        {
          labelName: "聯絡人電子信箱",
          inputName: "contactEmail",
          inputValue: contactEmail,
          validateWay: "email",
          isRequired: false,
        },
        {
          labelName: "公務手機",
          inputName: "contactPhoneMobile",
          inputValue: contactPhoneMobile,
          validateWay: "isString",
          isRequired: false,
        },
        {
          labelName: "聯絡人部門",
          inputName: "contactDepartment",
          inputValue: contactDepartment,
          validateWay: "isString",
          isRequired: false,
        },
        {
          labelName: "聯絡人職稱",
          inputName: "contactPosition",
          inputValue: contactPosition,
          validateWay: "isString",
          isRequired: false,
        },
      ])

      // @檢查用戶是否被刪除
      const user = await repository.frontendUsersRepo.findFrontendUserById(
        userId
      ) // 獲取用戶資料
      if (!user) {
        throw new Error("用戶不存在")
      }

      // @檢查EMAIL是否重複
      if (contactEmail) {
        const emailData = await repository.userProfilesRepo.findUserProfiles(
          { contact_email: contactEmail },
          transaction
        )
        if (Array.isArray(emailData) && emailData.length > 0) {
          return res.status(200).json({
            rtnCode: "0001",
            rtnMsg: "此聯絡人電子信箱已註冊，請輸入其他電子信箱。",
          })
        }
      }

      // @更新 UserProfiles 表的資料
      const profileData = {}
      if (contactPersonName) {
        profileData.contact_person_name = contactPersonName
      }
      if (contactPhoneOffice) {
        profileData.contact_phone_office = contactPhoneOffice
      }
      if (contactPhoneMobile) {
        profileData.contact_phone_mobile = contactPhoneMobile
      }
      if (contactDepartment) {
        profileData.contact_department = contactDepartment
      }
      if (contactPosition) {
        profileData.contact_position = contactPosition
      }
      if (contactEmail) {
        profileData.contact_email = contactEmail
      }
      if (Object.keys(profileData).length > 0) {
        await repository.userProfilesRepo.updateUserProfileByUserId(
          userId,
          profileData,
          transaction
        )
      }

      // @寫異動紀錄
      const editor = req.user.email // 假設從 req.user 獲取操作者資訊
      const changeLogData = {
        action_type: "update", // 操作類型
        user_id: userId,
        editor: editor,
        changes: req.body, // 變更的資料
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await repository.frontendUserLogsRepo.createFrontendUserLog(
        changeLogData,
        transaction
      )

      // 設置郵件內容
      const htmlContent = `
        <p>${
          contactPersonName || user.UserProfiles[0].contact_person_name
        } 您好，</p>
        <p>您的會員資料已成功更新，以下是更新後的資料：</p>
        <ul>
          ${
            contactPersonName
              ? `<li><strong>聯絡人姓名：</strong> ${contactPersonName}</li>`
              : `<li><strong>聯絡人姓名：</strong> ${user.UserProfiles[0].contact_person_name}</li>`
          }
          ${
            contactPhoneOffice
              ? `<li><strong>公務電話：</strong> ${contactPhoneOffice}</li>`
              : `<li><strong>公務電話：</strong> ${user.UserProfiles[0].contact_phone_office}</li>`
          }
          ${
            contactPhoneMobile
              ? `<li><strong>公務手機：</strong> ${contactPhoneMobile}</li>`
              : `<li><strong>公務手機：</strong> ${user.UserProfiles[0].contact_phone_mobile}</li>`
          }
          ${
            contactDepartment
              ? `<li><strong>聯絡人部門：</strong> ${contactDepartment}</li>`
              : `<li><strong>聯絡人部門：</strong> ${user.UserProfiles[0].contact_department}</li>`
          }
          ${
            contactPosition
              ? `<li><strong>聯絡人職稱：</strong> ${contactPosition}</li>`
              : `<li><strong>聯絡人職稱：</strong> ${user.UserProfiles[0].contact_position}</li>`
          }
          ${
            contactEmail
              ? `<li><strong>聯絡人電子信箱：</strong> ${contactEmail}</li>`
              : `<li><strong>聯絡人電子信箱：</strong> ${user.UserProfiles[0].contact_email}</li>`
          }
        </ul>
        <p>如果您發現上述資料有誤，請立即登入<a href="${
          process.env.SERVICE_HOST_FRONTEND
        }">系統</a>並進行修改。</p>
        <p>感謝您的使用！</p>
      `

      const to =
        contactEmail ||
        (user.UserProfiles && user.UserProfiles[0]
          ? user.UserProfiles[0].contact_email
          : null)
      if (!to) {
        return next(new Error("收件人電子郵件地址不存在"))
      }
      sendEmailBackground(
        to,
        `${process.env.SERVICE_NAME}會員資料更新通知`,
        htmlContent,
        next
      )

      await transaction.commit()
      transactionCommitted = true

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "會員修改成功",
      })
    } catch (err) {
      if (!transactionCommitted) {
        // 只有當交易尚未提交時才回滾
        await transaction.rollback()
      }
      err.code = "UPDATE_MEMBER_ERROR"
      next(err)
    }
  },
  deleteMember: async (req, res, next) => {
    const transaction = await db.sequelize.transaction()
    let transactionCommitted = false
    try {
      // @接收參數
      const { userId } = req.params

      // @驗證參數
      validateInput([
        {
          labelName: "使用者ID",
          inputName: "userId",
          inputValue: userId,
          validateWay: "isNumber",
          isRequired: true,
        },
      ])

      // @查找會員是否存在
      const user = await repository.frontendUsersRepo.findFrontendUserById(
        userId
      )
      if (!user) {
        return res.status(200).json({
          rtnCode: "0001",
          rtnMsg: "會員不存在",
        })
      }

      // @檢查該會員是否已經被刪除
      if (user.deletedAt) {
        return res.status(200).json({
          rtnCode: "0002",
          rtnMsg: "該會員已經被刪除",
        })
      }

      // @軟刪除會員
      const currentDate = new Date()
      await repository.frontendUsersRepo.deleteFrontendUser(userId, transaction)

      // @寫異動紀錄
      const editor = req.user.email // 假設從 req.user 獲取操作者資訊
      const changes = {
        userId: userId,
        deletedAt: currentDate.toLocaleString(),
      }
      const changeLogData = {
        action_type: "delete", // 操作類型
        user_id: userId, // 被刪除的會員ID
        editor: editor, // 操作者
        changes: JSON.stringify(changes), // 變更的內容
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await repository.frontendUserLogsRepo.createFrontendUserLog(
        changeLogData,
        transaction
      )

      // @取得金管會窗口資訊
      const fsc = await repository.backendUsersRepo.getFSCContactUsers(
        transaction
      )
      const fscContactInfo = fsc
        .map(
          (contact) => `
            <p>聯絡人：${contact.backend_user_account}</p>
            <p>Email：${contact.email}</p>
          `
        )
        .join("")

      // @發送刪除通知郵件
      // 設置郵件內容
      const htmlContent = `
        <p>${user.UserProfiles[0].contact_person_name} 您好，</p>
        <p>您的帳號已於 ${currentDate.toLocaleString()} 被我們的系統管理員刪除。</p>
        <p>如果您有任何疑問或需要協助，請聯繫金管會窗口，聯絡資訊如下：</p>
        ${fscContactInfo}
        
        <p>感謝您的使用！</p>
      `
      sendEmailBackground(
        user.UserProfiles[0].contact_email,
        `${process.env.SERVICE_NAME}會員資料更新通知`,
        htmlContent,
        next
      )

      await transaction.commit()
      transactionCommitted = true

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "會員刪除成功",
      })
    } catch (err) {
      if (!transactionCommitted) {
        await transaction.rollback()
      }
      err.code = "DELETE_MEMBER_ERROR"
      next(err)
    }
  },
  // -角色管理 API
  BOgetRolesList: async (req, res, next) => {
    const transaction = await db.sequelize.transaction()
    let transactionCommitted = false
    try {
      let {
        roleName,
        createdAtStart,
        createdAtEnd,
        creator,
        updatedAtStart,
        updatedAtEnd,
        editor,
        status,
        page = 1,
        pageSize = 10,
        sortBy = "updatedAt",
        sortDirection = "DESC",
      } = req.query

      if (roleName) {
        roleName = JSON.parse(roleName)
      }

      // 驗證參數
      const validatedData = validateInput([
        {
          labelName: "建立時間(起)",
          inputName: "createdAtStart",
          inputValue: createdAtStart,
          validateWay: "isDate",
          isRequired: false,
        },
        {
          labelName: "建立時間(訖)",
          inputName: "createdAtEnd",
          inputValue: createdAtEnd,
          validateWay: "isDate",
          isRequired: false,
        },
        {
          labelName: "修改時間(起)",
          inputName: "updatedAtStart",
          inputValue: updatedAtStart,
          validateWay: "isDate",
          isRequired: false,
        },
        {
          labelName: "修改時間(訖)",
          inputName: "updatedAtEnd",
          inputValue: updatedAtEnd,
          validateWay: "isDate",
          isRequired: false,
        },
        {
          labelName: "狀態",
          inputName: "status",
          inputValue: status,
          validateWay: "isNumber",
          isRequired: false,
        },
        {
          labelName: "建立者",
          inputName: "creator",
          inputValue: creator,
          validateWay: "isString",
          isRequired: false,
        },
        {
          labelName: "修改者",
          inputName: "editor",
          inputValue: editor,
          validateWay: "isString",
          isRequired: false,
        },
        {
          labelName: "角色名稱",
          inputName: "roleName",
          inputValue: roleName,
          validateWay: "isArray",
          isRequired: false,
        },
        {
          labelName: "每頁數量",
          inputName: "pageSize",
          inputValue: pageSize,
          validateWay: "isNumber",
          isRequired: false,
        },
        {
          labelName: "頁碼",
          inputName: "page",
          inputValue: page,
          validateWay: "isNumber",
          isRequired: false,
        },
        {
          labelName: "排序欄位",
          inputName: "sortBy",
          inputValue: sortBy,
          validateWay: "isString",
          isRequired: false,
        },
        {
          labelName: "排序方向",
          inputName: "sortDirection",
          inputValue: sortDirection,
          validateWay: "isString",
          toUpperCase: true,
          isRequired: false,
        },
      ])

      const rolesData = await repository.rolesRepo.findAndCountAllRoles(
        validatedData,
        transaction
      )

      if (rolesData.count === 0) {
        await transaction.commit()
        transactionCommitted = true

        return res.status(200).json({
          rtnCode: "0001",
          rtnMsg: "查無結果",
        })
      }

      await transaction.commit()
      transactionCommitted = true

      // 格式化輸出數據
      const formattedRoles = rolesData.rows.map((role) => ({
        roleId: role.role_id,
        roleName: role.role_name,
        createdAt: role.createdAt,
        creator: role.creator,
        updatedAt: role.updatedAt,
        editor: role.editor,
        status: role.role_status,
      }))

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "查詢成功",
        data: formattedRoles,
        pagination: {
          page: parseInt(page),
          perPage: parseInt(pageSize),
          totalPages: Math.ceil(rolesData.count / pageSize),
          totalCount: rolesData.count,
        },
      })
    } catch (err) {
      if (!transactionCommitted) {
        // 只有當交易尚未提交時才回滾
        await transaction.rollback()
      }
      err.code = "GET_ROLES_LIST_ERROR"
      next(err)
    }
  },
  BOgetUsersByRole: async (req, res, next) => {
    const transaction = await db.sequelize.transaction()
    let transactionCommitted = false
    try {
      // 從請求中取得角色ID
      const { roleId } = req.params

      const validatedData = validateInput([
        {
          labelName: "角色ID",
          inputName: "roleId",
          inputValue: roleId,
          validateWay: "isNumber",
          isRequired: true,
        },
      ])

      // 假設 User_Roles 和 Backend_users 之間已經建立了關聯
      const users = await repository.userRolesRepo.findUserRoles(
        validatedData.roleId,
        transaction
      )

      await transaction.commit()
      transactionCommitted = true

      if (!users.length) {
        return res.status(200).json({
          rtnCode: "0001",
          rtnMsg: "未找到該角色的使用者",
        })
      }

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "查詢成功",
        data: snakeToCamel(
          users.map((user) => ({
            backendUserAccount: user.backend_user_account,
          }))
        ),
      })
    } catch (err) {
      if (!transactionCommitted) {
        // 只有當交易尚未提交時才回滾
        await transaction.rollback()
      }
      err.code = "GET_USERS_BY_ROLE_ERROR"
      next(err)
    }
  },
  BOgetRolePermissions: async (req, res, next) => {
    const transaction = await db.sequelize.transaction()
    let transactionCommitted = false
    try {
      // 從請求中取得角色ID
      const { roleId } = req.params

      // 驗證參數
      const validatedData = validateInput([
        {
          labelName: "角色ID",
          inputName: "roleId",
          inputValue: roleId,
          validateWay: "isNumber",
          isRequired: false,
        },
      ])

      const permissions =
        await repository.rolePermissionsRepo.getRolePermissionsById(
          validatedData.roleId,
          transaction
        )

      await transaction.commit()
      transactionCommitted = true

      // 如果沒有查詢到任何權限數據，則返回角色不存在的錯誤
      if (!permissions) {
        return res.status(200).json({
          rtnCode: "0001",
          rtnMsg: "角色不存在或無權限",
        })
      }

      // 構建回傳數據結構
      const responseData = {
        rtnCode: "0000",
        rtnMsg: "查詢成功",
        data: permissions, // 直接使用從資料庫中查詢得到的數據
      }

      return res.status(200).json(responseData)
    } catch (err) {
      if (!transactionCommitted) {
        // 只有當交易尚未提交時才回滾
        await transaction.rollback()
      }
      err.code = "GET_ROLE_PERMISSIONS_ERROR"
      next(err)
    }
  },
  BOcreateRole: async (req, res, next) => {
    const transaction = await db.sequelize.transaction()
    let transactionCommitted = false
    try {
      const { roleName, roleStatus, permissions } = req.body

      // 驗證參數
      const validatedData = validateInput([
        {
          labelName: "角色名稱",
          inputName: "roleName",
          inputValue: roleName,
          validateWay: "isString",
          isRequired: true,
        },
        {
          labelName: "狀態",
          inputName: "roleStatus",
          inputValue: roleStatus,
          validateWay: "isNumber",
          isRequired: true,
        },
        {
          labelName: "權限",
          inputName: "permissions",
          inputValue: permissions,
          validateWay: "isArray",
          isRequired: false,
        },
      ])

      const existingRole = await repository.rolesRepo.findByName(
        validatedData.roleName,
        {
          transaction,
        }
      )
      if (existingRole) {
        await transaction.commit()
        transactionCommitted = true

        return res.status(200).json({
          rtnCode: "0001",
          rtnMsg: "角色名稱已存在",
        })
      }

      const creator = req.user.email

      // 創建角色
      const newRole = await repository.rolesRepo.createRole(
        {
          role_name: validatedData.roleName,
          role_status: validatedData.roleStatus,
          creator: creator,
          editor: creator,
        },
        { transaction }
      )

      // 設定角色權限關聯
      const rolePermissions = permissions.map((p) => ({
        role_id: newRole.role_id,
        permission_id: p.permission_id,
      }))
      await repository.rolePermissionsRepo.setRolePermissions(rolePermissions, {
        transaction,
      })

      await transaction.commit()
      transactionCommitted = true

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "角色新增成功",
      })
    } catch (err) {
      // 處理錯誤，並將錯誤傳遞給下一個中間件
      err.code = "CREATE_ROLE_ERROR"
      if (!transactionCommitted) {
        // 只有當交易尚未提交時才回滾
        await transaction.rollback()
      }
      next(err)
    }
  },
  BOgetPagesAndButtonsList: async (req, res, next) => {
    const transaction = await db.sequelize.transaction()
    let transactionCommitted = false
    try {
      const { roleId } = req.query

      // 驗證參數
      const validatedData = validateInput([
        {
          labelName: "角色ID",
          inputName: "roleId",
          inputValue: roleId,
          validateWay: "isNumber",
          isRequired: false,
        },
      ])

      // 檢查角色是否為 admin
      let isAdmin = false
      if (validatedData.roleId) {
        const role = await repository.rolesRepo.getRoleById(
          validatedData.roleId,
          transaction
        )
        if (!role) {
          await transaction.commit()
          transactionCommitted = true

          return res.status(200).json({
            rtnCode: "0001",
            rtnMsg: "角色不存在",
          })
        }

        isAdmin = role.role_name === "Admin"
      }

      // 從資料庫中獲取所有頁面權限，其中包括按鈕
      const pages = await repository.permissionRepo.getPagesAndButtons(
        isAdmin,
        transaction
      )

      await transaction.commit()
      transactionCommitted = true

      // 轉換格式以符合前端要求
      const formattedData = pages
        .map((collapse) => ({
          permissionId: collapse.permission_id,
          permissionName: collapse.permission_name,
          permissionType: collapse.permission_type,
          children: collapse.children
            .map((page) => ({
              permissionId: page.permission_id,
              permissionName: page.permission_name,
              permissionType: page.permission_type,
              children: page.children
                .map((btn) => ({
                  permissionId: btn.permission_id,
                  permissionName: btn.permission_name,
                  permissionSequence: btn.permission_sequence,
                  permissionType: btn.permission_type,
                }))
                .sort((a, b) => a.permissionSequence - b.permissionSequence), // 排序按鈕
            }))
            .sort((a, b) => a.permissionSequence - b.permissionSequence), // 排序頁面
        }))
        .sort((a, b) => a.permissionSequence - b.permissionSequence) // 排序 collapse

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "查詢成功",
        data: formattedData,
      })
    } catch (err) {
      if (!transactionCommitted) {
        // 只有當交易尚未提交時才回滾
        await transaction.rollback()
      }
      err.code = "GET_PAGES_AND_BUTTONS_LIST_ERROR"
      next(err)
    }
  },
  BOupdateRole: async (req, res, next) => {
    const transaction = await db.sequelize.transaction()
    let transactionCommitted = false
    try {
      // 從請求中提取角色ID和其他更新數據
      const { roleId } = req.params // 假設角色ID來自URL參數
      const { roleName, roleStatus, permissions } = req.body // 從請求主體中提取角色名稱和權限資料

      // 驗證參數
      const validatedData = validateInput([
        {
          labelName: "角色ID",
          inputName: "roleId",
          inputValue: roleId,
          validateWay: "isNumber",
          isRequired: true,
        },
        {
          labelName: "角色名稱",
          inputName: "roleName",
          inputValue: roleName,
          validateWay: "isString",
          isRequired: true,
        },
        {
          labelName: "狀態",
          inputName: "roleStatus",
          inputValue: roleStatus,
          validateWay: "isNumber",
          isRequired: true,
        },
        {
          labelName: "權限",
          inputName: "permissions",
          inputValue: permissions,
          validateWay: "isArray",
          isRequired: false,
        },
      ])

      const editor = req.user.email

      await repository.rolesRepo.updateRoleById(
        validatedData.roleId,
        validatedData.roleName,
        validatedData.roleStatus,
        validatedData.permissions,
        editor,
        transaction
      )

      await transaction.commit()
      transactionCommitted = true

      // 回傳成功訊息
      const response = {
        rtnCode: "0000",
        rtnMsg: "角色更新成功",
      }

      return res.status(200).json(response)
    } catch (err) {
      // 處理錯誤，並將錯誤傳遞給下一個中間件
      err.code = "UPDATE_ROLE_ERROR"
      if (!transactionCommitted) {
        // 只有當交易尚未提交時才回滾
        await transaction.rollback()
      }
      next(err)
    }
  },
  BOtoggleRoleStatus: async (req, res, next) => {
    const transaction = await db.sequelize.transaction()
    let transactionCommitted = false
    try {
      const roleId = req.params.roleId

      // 驗證參數
      const validatedData = validateInput([
        {
          labelName: "角色ID",
          inputName: "roleId",
          inputValue: roleId,
          validateWay: "isNumber",
          isRequired: true,
        },
      ])

      // 從資料操作層獲取角色目前狀態
      const role = await repository.rolesRepo.getRoleById(
        validatedData.roleId,
        transaction
      )
      if (!role) {
        await transaction.commit()
        transactionCommitted = true

        return res.status(200).json({
          rtnCode: "0001",
          rtnMsg: "角色不存在",
        })
      }

      // 切換狀態：如果當前為啟用（0），則禁用（1），反之亦然
      const newStatus = role[0].dataValues.role_status === 0 ? 1 : 0

      // 取得當前使用者帳號
      const user = req.user.email

      // 更新角色狀態
      await repository.rolesRepo.updateRoleStatus(
        validatedData.roleId,
        newStatus,
        user,
        transaction
      )

      await transaction.commit()
      transactionCommitted = true

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "角色狀態更新成功",
      })
    } catch (err) {
      if (!transactionCommitted) {
        // 只有當交易尚未提交時才回滾
        await transaction.rollback()
      }
      err.code = "TOGGLE_ROLE_STATUS_ERROR"
      next(err)
    }
  },
  // -後台首頁 API
  BOgetloginHistory: async (req, res, next) => {
    const transaction = await db.sequelize.transaction()
    let transactionCommitted = false
    try {
      const { limit = 10, status } = req.query

      const validatedData = validateInput([
        {
          labelName: "筆數限制",
          inputName: "limit",
          inputValue: limit,
          validateWay: "isNumber",
          isRequired: false,
        },
        {
          labelName: "登入狀態",
          inputName: "status",
          inputValue: status,
          validateWay: "isNumber",
          isRequired: false,
        },
      ])

      const backendUser = req.user.email

      const histories =
        await repository.backendLoginHistoriesRepo.findBackendUserLoginHistories(
          {
            account: backendUser,
            limit,
            status: status ? status : undefined,
          },
          transaction
        )

      await transaction.commit()
      transactionCommitted = true

      // 使用 map() 函數來選取所需的字段
      const simplifiedHistories = histories.map((history) => {
        return {
          ipAddress: history.ipAddress,
          createdAt: history.createdAt,
        }
      })

      const response = {
        rtnCode: "0000",
        rtnMsg: "成功取得最近登入紀錄",
        data: simplifiedHistories,
      }

      return res.status(200).json(response)
    } catch (err) {
      if (!transactionCommitted) {
        // 只有當交易尚未提交時才回滾
        await transaction.rollback()
      }
      err.code = "getloginHistory_ERROR"
      next(err)
    }
  },
  // -資料管理者與審核者對應 API
  BOgetAuditMappings: async (req, res, next) => {
    const transaction = await db.sequelize.transaction()
    try {
      let {
        auditGroupName,
        auditUserAccount,
        wordManagerUserAccounts,
        creator,
        editor,
        createdAtStart,
        createdAtEnd,
        updatedAtStart,
        updatedAtEnd,
        sortBy = "updatedAt",
        sortDirection = "ASC",
        page = 1,
        pageSize = 10,
      } = req.query

      if (wordManagerUserAccounts) {
        wordManagerUserAccounts = JSON.parse(wordManagerUserAccounts)
      }

      // 驗證參數
      const validatedData = validateInput([
        {
          labelName: "建立時間(起)",
          inputName: "createdAtStart",
          inputValue: createdAtStart,
          validateWay: "isDate",
          isRequired: false,
        },
        {
          labelName: "建立時間(訖)",
          inputName: "createdAtEnd",
          inputValue: createdAtEnd,
          validateWay: "isDate",
          isRequired: false,
        },
        {
          labelName: "修改時間(起)",
          inputName: "updatedAtStart",
          inputValue: updatedAtStart,
          validateWay: "isDate",
          isRequired: false,
        },
        {
          labelName: "修改時間(訖)",
          inputName: "updatedAtEnd",
          inputValue: updatedAtEnd,
          validateWay: "isDate",
          isRequired: false,
        },
        {
          labelName: "群組名稱",
          inputName: "auditGroupName",
          inputValue: auditGroupName,
          validateWay: "isString",
          isRequired: false,
        },
        {
          labelName: "審核者後台帳號",
          inputName: "auditUserAccount",
          inputValue: auditUserAccount,
          validateWay: "isString",
          isRequired: false,
        },
        {
          labelName: "資料管理者後台帳號",
          inputName: "wordManagerUserAccounts",
          inputValue: wordManagerUserAccounts,
          validateWay: "isArray",
          isRequired: false,
        },
        {
          labelName: "建立者",
          inputName: "creator",
          inputValue: creator,
          validateWay: "isString",
          isRequired: false,
        },
        {
          labelName: "修改者",
          inputName: "editor",
          inputValue: editor,
          validateWay: "isString",
          isRequired: false,
        },
        {
          labelName: "每頁數量",
          inputName: "pageSize",
          inputValue: pageSize,
          validateWay: "isNumber",
          isRequired: false,
        },
        {
          labelName: "頁碼",
          inputName: "page",
          inputValue: page,
          validateWay: "isNumber",
          isRequired: false,
        },
        {
          labelName: "排序欄位",
          inputName: "sortBy",
          inputValue: sortBy,
          validateWay: "isString",
          isRequired: false,
        },
        {
          labelName: "排序方向",
          inputName: "sortDirection",
          inputValue: sortDirection,
          validateWay: "isString",
          toUpperCase: true,
          isRequired: false,
        },
      ])

      const { rows, count } =
        await repository.auditGroupsRepo.getAllAuditMappings(
          validatedData,
          transaction
        )

      await transaction.commit()

      if (count == 0) {
        return res.status(200).json({
          rtnCode: "0001",
          rtnMsg: "無符合條件的查詢結果",
        })
      }

      const totalPages = Math.ceil(count / pageSize)

      const formattedData = rows.map((mapping) => ({
        auditGroupId: mapping.audit_group_id,
        auditGroupName: mapping.audit_group_name,
        auditUserAccount: mapping.audit_user_account,
        wordManagerUserAccounts: mapping.Audit_groups_details.map(
          (detail) => detail.word_manager_user_account
        ),
        creator: mapping.creator,
        editor: mapping.editor,
        createdAt: mapping.createdAt,
        updatedAt: mapping.updatedAt,
      }))

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "查詢成功",
        data: utilHelper.snakeToCamel(formattedData),
        pagination: {
          page: parseInt(page, 10),
          perPage: parseInt(pageSize, 10),
          totalPages,
          totalCount: count,
        },
      })
    } catch (err) {
      await transaction.rollback()
      err.code = "GET_AUDIT_MAPPINGS_ERROR"
      next(err)
    }
  },
  BOcreateAuditMapping: async (req, res, next) => {
    const transaction = await db.sequelize.transaction()
    try {
      const { auditGroupName, auditUserAccount, wordManagerUserAccounts } =
        req.body

      // 驗證參數
      const validatedData = validateInput([
        {
          labelName: "群組名稱",
          inputName: "auditGroupName",
          inputValue: auditGroupName,
          validateWay: "isString",
          isRequired: true,
        },
        {
          labelName: "審核者後台帳號",
          inputName: "auditUserAccount",
          inputValue: auditUserAccount,
          validateWay: "isString",
          isRequired: true,
        },
        {
          labelName: "資料管理者後台帳號",
          inputName: "wordManagerUserAccounts",
          inputValue: wordManagerUserAccounts,
          validateWay: "isArray",
          isRequired: false,
        },
      ])

      const creator = req.user.email

      const result = await repository.auditGroupsRepo.createAuditMapping(
        validatedData.auditGroupName,
        validatedData.auditUserAccount,
        validatedData.wordManagerUserAccounts,
        creator,
        transaction
      )

      await transaction.commit()

      if (result.message !== "success") {
        return res.status(200).json({
          rtnCode: "0001",
          rtnMsg: result.message,
        })
      }

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "新增成功",
      })
    } catch (err) {
      // 處理錯誤，並將錯誤傳遞給下一個中間件
      err.code = "CREATE_AUDIT_MAPPING_ERROR"
      await transaction.rollback()
      next(err)
    }
  },
  BOupdateAuditMapping: async (req, res, next) => {
    const transaction = await db.sequelize.transaction()
    try {
      const {
        auditGroupId,
        auditGroupName,
        auditUserAccount,
        wordManagerUserAccounts,
      } = req.body

      const validatedData = validateInput([
        {
          labelName: "群組Id",
          inputName: "auditGroupId",
          inputValue: auditGroupId,
          validateWay: "isNumber",
          isRequired: false,
        },
        {
          labelName: "群組名稱",
          inputName: "auditGroupName",
          inputValue: auditGroupName,
          validateWay: "isString",
          isRequired: false,
        },
        {
          labelName: "審核者後台帳號",
          inputName: "auditUserAccount",
          inputValue: auditUserAccount,
          validateWay: "isString",
          isRequired: false,
        },
        {
          labelName: "資料管理者後台帳號",
          inputName: "wordManagerUserAccounts",
          inputValue: wordManagerUserAccounts,
          validateWay: "isArray",
          isRequired: false,
        },
      ])

      const editor = req.user.email

      const result = await repository.auditGroupsRepo.updateAuditMapping(
        validatedData.auditGroupId,
        validatedData.auditGroupName,
        validatedData.auditUserAccount,
        validatedData.wordManagerUserAccounts,
        editor,
        transaction
      )

      await transaction.commit()

      if (result.message !== "success") {
        return res.status(200).json({
          rtnCode: "0001",
          rtnMsg: result.message,
        })
      }

      // 假設更新對應操作成功，並返回模擬的對應數據
      const response = {
        rtnCode: "0000",
        rtnMsg: "更新對應成功",
      }

      return res.status(200).json(response)
    } catch (err) {
      // 處理錯誤，並將錯誤傳遞給下一個中間件
      err.code = "UPDATE_AUDIT_MAPPING_ERROR"
      await transaction.rollback()
      next(err)
    }
  },
  BOgetAuditMappingById: async (req, res, next) => {
    const transaction = await db.sequelize.transaction()
    try {
      const auditGroupId = req.params.auditGroupId

      const validatedData = validateInput([
        {
          labelName: "群組Id",
          inputName: "auditGroupId",
          inputValue: auditGroupId,
          validateWay: "isNumber",
          isRequired: true,
        },
      ])

      const auditGroupDetails =
        await repository.auditGroupsDetailRepo.getAuditGroupDetails(
          validatedData.auditGroupId,
          transaction
        )

      // 轉換成只有 user_account 的陣列，以便快速查找
      const memberUserAccounts = auditGroupDetails.map(
        (member) => member.userAccount
      )

      // 獲取所有使用者
      const allUsers = await repository.backendUsersRepo.getUsersWithStatusZero(
        transaction
      )

      // 標記群組成員
      const markedUsers = allUsers.map((user) => ({
        userAccount: user.backend_user_account,
        isChecked: memberUserAccounts.includes(user.backend_user_account),
      }))

      const response = {
        rtnCode: "0000",
        rtnMsg: "查詢相關對應",
        data: utilHelper.snakeToCamel(markedUsers),
      }

      return res.status(200).json(response)
    } catch (err) {
      // 處理錯誤，並將錯誤傳遞給下一個中間件
      err.code = "getAuditMappingById_ERROR"
      await transaction.rollback()
      next(err)
    }
  },
  // - IP管理 API
  BOaddIPWhitelist: async (req, res, next) => {
    const transaction = await db.sequelize.transaction()
    try {
      const { name, singleIp, ipStart, ipEnd } = req.body

      const validatedData = validateInput([
        {
          labelName: "名稱",
          inputName: "name",
          inputValue: name,
          validateWay: "isString",
          isRequired: true,
        },
        {
          labelName: "單一IP",
          inputName: "singleIp",
          inputValue: singleIp,
          validateWay: "isString",
          isRequired: false,
        },
        {
          labelName: "IP區段(起)",
          inputName: "ipStart",
          inputValue: ipStart,
          validateWay: "isString",
          isRequired: false,
        },
        {
          labelName: "IP區段(迄)",
          inputName: "ipEnd",
          inputValue: ipEnd,
          validateWay: "isString",
          isRequired: false,
        },
      ])

      const user = req.user.email

      // 檢查 單一IP 和 IP區段 不能同時出現
      if (
        validatedData.singleIp &&
        (validatedData.ipStart || validatedData.ipEnd)
      ) {
        await transaction.commit()
        return res.status(200).json({
          rtnCode: "0001",
          rtnMsg: "不能同時提供單一 IP 和 IP 區段",
        })
      }

      // 檢查單一IP格式
      const singleIpRegex =
        /^(?:(?:\d{1,3}\.){3}\d{1,3}|\d{1,3}\.\d{1,3}\.\d{1,3}\.\*)$/

      if (singleIp && !singleIp.match(singleIpRegex)) {
        await transaction.commit()
        return res.status(200).json({
          rtnCode: "0002",
          rtnMsg: "單一 IP 格式不正確",
        })
      }

      // 檢查IP區段格式
      const ipRangeRegex = /^(?:(?:\d{1,3}\.){3}\d{1,3})$/

      // 檢查IP區段格式
      if (
        (validatedData.ipStart || validatedData.ipEnd) &&
        (validatedData.ipStart.match(/\*/) || validatedData.ipEnd.match(/\*/))
      ) {
        await transaction.commit()
        return res.status(200).json({
          rtnCode: "0003",
          rtnMsg: "IP 區段不能使用 * 號",
        })
      }

      if (
        !validatedData.ipStart.match(ipRangeRegex) &&
        !validatedData.ipEnd.match(ipRangeRegex)
      ) {
        await transaction.commit()
        return res.status(200).json({
          rtnCode: "0004",
          rtnMsg: "IP 區段格式錯誤",
        })
      }

      // 調用 repository 層進行數據處理
      await repository.ipWhitelistRepo.addIP(
        {
          name: validatedData.name,
          singleIp: validatedData.singleIp,
          ipStart: validatedData.ipStart,
          ipEnd: validatedData.ipEnd,
          user: user,
        },
        transaction
      )

      await transaction.commit()

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "IP白名單新增成功",
      })
    } catch (err) {
      await transaction.rollback()
      err.code = "addIPWhitelist_ERROR"
      next(err)
    }
  },
  BOsearchIPWhitelists: async (req, res, next) => {
    const transaction = await db.sequelize.transaction()
    try {
      const {
        ip,
        name,
        userAccount,
        whitelistId,
        createdAtStart,
        createdAtEnd,
        updatedAtStart,
        updatedAtEnd,
        page = 1,
        pageSize = 10,
        sortBy = "updatedAt",
        sortDirection = "DESC",
      } = req.query

      const validatedData = validateInput([
        {
          labelName: "ip",
          inputName: "ip",
          inputValue: ip,
          validateWay: "isString",
          isRequired: false,
        },
        {
          labelName: "IP名稱區段",
          inputName: "name",
          inputValue: name,
          validateWay: "isString",
          isRequired: false,
        },
        {
          labelName: "使用者帳號",
          inputName: "userAccount",
          inputValue: userAccount,
          validateWay: "isString",
          isRequired: false,
        },
        {
          labelName: "IP白名單id",
          inputName: "whitelistId",
          inputValue: whitelistId,
          validateWay: "isString",
          isRequired: false,
        },
        {
          labelName: "建立時間(起)",
          inputName: "createdAtStart",
          inputValue: createdAtStart,
          validateWay: "isDate",
          isRequired: false,
        },
        {
          labelName: "建立時間(訖)",
          inputName: "createdAtEnd",
          inputValue: createdAtEnd,
          validateWay: "isDate",
          isRequired: false,
        },
        {
          labelName: "修改時間(起)",
          inputName: "updatedAtStart",
          inputValue: updatedAtStart,
          validateWay: "isDate",
          isRequired: false,
        },
        {
          labelName: "修改時間(訖)",
          inputName: "updatedAtEnd",
          inputValue: updatedAtEnd,
          validateWay: "isDate",
          isRequired: false,
        },
        {
          labelName: "每頁數量",
          inputName: "pageSize",
          inputValue: pageSize,
          validateWay: "isNumber",
          isRequired: false,
        },
        {
          labelName: "頁碼",
          inputName: "page",
          inputValue: page,
          validateWay: "isNumber",
          isRequired: false,
        },
        {
          labelName: "排序欄位",
          inputName: "sortBy",
          inputValue: sortBy,
          validateWay: "isString",
          isRequired: false,
        },
        {
          labelName: "排序方向",
          inputName: "sortDirection",
          inputValue: sortDirection,
          validateWay: "isString",
          toUpperCase: true,
          isRequired: false,
        },
      ])

      // 進行查詢
      const data = await repository.ipWhitelistRepo.searchIP({
        ...validatedData,
        limit: validatedData.pageSize,
        offset: (validatedData.page - 1) * validatedData.pageSize,
        transaction,
      })

      await transaction.commit()

      if (data.pagination.totalCount === 0) {
        return res.status(200).json({
          rtnCode: "0001",
          rtnMsg: "未找到符合條件的 IP 白名單記錄。",
        })
      }

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "IP白名單搜尋成功",
        data: data.data,
        pagination: data.pagination,
      })
    } catch (err) {
      await transaction.rollback()
      err.code = "searchIPWhitelists_ERROR"
      next(err)
    }
  },
  BOupdateIPWhitelist: async (req, res, next) => {
    const transaction = await db.sequelize.transaction()
    try {
      const { id } = req.params
      const { name, singleIp, ipStart, ipEnd } = req.body

      const validatedData = validateInput([
        {
          labelName: "白名單id",
          inputName: "id",
          inputValue: id,
          validateWay: "isNumber",
          isRequired: true,
        },
        {
          labelName: "名稱",
          inputName: "name",
          inputValue: name,
          validateWay: "isString",
          isRequired: false,
        },
        {
          labelName: "單一IP",
          inputName: "singleIp",
          inputValue: singleIp,
          validateWay: "isString",
          isRequired: false,
        },
        {
          labelName: "IP區段(起)",
          inputName: "ipStart",
          inputValue: ipStart,
          validateWay: "isString",
          isRequired: false,
        },
        {
          labelName: "IP區段(迄)",
          inputName: "ipEnd",
          inputValue: ipEnd,
          validateWay: "isString",
          isRequired: false,
        },
      ])

      const user = req.user.email

      // 驗證 IP 格式
      const singleIpRegex =
        /^(?:(?:\d{1,3}\.){3}\d{1,3}|\d{1,3}\.\d{1,3}\.\d{1,3}\.\*)$/

      if (singleIp && !singleIp.match(singleIpRegex)) {
        await transaction.commit()
        return res.status(200).json({
          rtnCode: "0001",
          rtnMsg: "單一 IP 格式不正確",
        })
      }

      if (
        (validatedData.ipStart || validatedData.ipEnd) &&
        (validatedData.ipStart.includes("*") ||
          validatedData.ipEnd.includes("*"))
      ) {
        await transaction.commit()
        return res.status(200).json({
          rtnCode: "0002",
          rtnMsg: "IP區段不可使用*號",
        })
      }

      // 更新 IP 白名單
      const updateResult = await repository.ipWhitelistRepo.updateIPWhitelist(
        {
          id: validatedData.id,
          name: validatedData.name,
          singleIp: validatedData.singleIp,
          ipStart: validatedData.ipStart,
          ipEnd: validatedData.ipEnd,
          user: user,
        },
        transaction
      )

      await transaction.commit()

      if (!updateResult) {
        return res.status(200).json({
          rtnCode: "0003",
          rtnMsg: "找不到指定的 IP 白名單",
        })
      }

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "IP白名單更新成功",
      })
    } catch (err) {
      await transaction.rollback()
      err.code = "updateIPWhitelist_ERROR"
      next(err)
    }
  },
  BOdeleteIPWhitelist: async (req, res, next) => {
    const transaction = await db.sequelize.transaction()
    try {
      const { id } = req.params

      const deleted = await repository.ipWhitelistRepo.deleteIPWhitelist(
        id,
        transaction
      )

      await transaction.commit()

      if (!deleted) {
        return res.status(200).json({
          rtnCode: "0001",
          rtnMsg: "未找到對應的 IP 白名單，删除失敗",
        })
      }

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "IP白名單删除成功",
      })
    } catch (err) {
      await transaction.rollback()
      err.code = "deleteIPWhitelist_ERROR"
      next(err)
    }
  },
  // >前台使用者管理
  // -註冊
  registerUser: async (req, res, next) => {
    const transaction = await db.sequelize.transaction()
    let transactionCommitted = false
    try {
      // @接收參數
      const {
        username, // 帳號
        password, // 密碼
        isSupplier = false, // 是否為供給方
        institutionName, // 單位名稱
        institutionAbbr, // 單位簡稱
        userTypeId, // 單位別
        contactPersonName, // 聯絡人姓名
        contactPhoneOffice, // 聯絡人電話
        contactPhoneMobile, // 聯絡人手機
        contactEmail, // 聯絡人電子信箱
        contactDepartment, // 聯絡人部門
        contactPosition, // 聯絡人職稱
      } = req.body

      // @驗證輸入
      validateInput([
        {
          labelName: "帳號",
          inputName: "username",
          inputValue: username,
          validateWay: "isString",
          isRequired: true,
        },
        {
          labelName: "密碼",
          inputName: "password",
          inputValue: password,
          validateWay: "isString",
          isRequired: true,
          patterns: [
            "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!\"#$%&'()*+,\\-./:;<=>?@[\\]^_`{|}~])[A-Za-z\\d!\"#$%&'()*+,\\-./:;<=>?@[\\]^_`{|}~]{8,}$",
          ],
          minLength: 7,
          customMessages: {
            "string.pattern.base":
              "密碼必須包含至少8個字符，且包含英文字母、數字和符號。",
            "string.min": "密碼長度至少需要8個字符。",
          },
        },
        {
          labelName: "是否為供給方",
          inputName: "isSupplier",
          inputValue: isSupplier,
          validateWay: "isBoolean",
          isRequired: true,
        },
        {
          labelName: "單位別ID",
          inputName: "userTypeId",
          inputValue: userTypeId,
          validateWay: "isNumber",
          isRequired: true,
        },
        {
          labelName: "單位名稱",
          inputName: "institutionName",
          inputValue: institutionName,
          validateWay: "isString",
          isRequired: true,
        },
        {
          labelName: "單位簡稱",
          inputName: "institutionAbbr",
          inputValue: institutionAbbr,
          validateWay: "isString",
          isRequired: true,
        },
        {
          labelName: "聯絡人姓名",
          inputName: "contactPersonName",
          inputValue: contactPersonName,
          validateWay: "isString",
          isRequired: true,
        },
        {
          labelName: "聯絡人電話",
          inputName: "contactPhoneOffice",
          inputValue: contactPhoneOffice,
          validateWay: "isString",
          isRequired: true,
        },
        {
          labelName: "聯絡人手機",
          inputName: "contactPhoneMobile",
          inputValue: contactPhoneMobile,
          validateWay: "isString",
          isRequired: true,
        },
        {
          labelName: "聯絡人Email",
          inputName: "contactEmail",
          inputValue: contactEmail,
          validateWay: "email",
          isRequired: true,
        },
        {
          labelName: "聯絡人部門",
          inputName: "contactDepartment",
          inputValue: contactDepartment,
          validateWay: "isString",
          isRequired: true,
        },
        {
          labelName: "聯絡人職稱",
          inputName: "contactPosition",
          inputValue: contactPosition,
          validateWay: "isString",
          isRequired: true,
        },
      ])

      // @驗證是否是需求方
      if (isSupplier === true) {
        throw new Error("請使用供給方註冊")
      }

      // @檢驗 username, email 註冊狀況
      const userData = await repository.frontendUsersRepo.usernameUnique({
        username,
        transaction,
      })
      const emailData = await repository.userProfilesRepo.findUserProfiles(
        { contact_email: contactEmail },
        transaction
      )
      if (
        userData &&
        (userData.account_status === 0 || userData.account_status === -1)
      ) {
        await transaction.commit()
        transactionCommitted = true

        if (Array.isArray(emailData) && emailData.length > 0) {
          return res.status(200).json({
            rtnCode: "0001",
            rtnMsg:
              "此帳號已註冊，請輸入其他帳號名稱。<br>此聯絡人電子信箱已註冊，請輸入其他電子信箱。",
          })
        } else {
          return res.status(200).json({
            rtnCode: "0001",
            rtnMsg: "此帳號已註冊，請輸入其他帳號名稱。",
          })
        }
      }
      if (Array.isArray(emailData) && emailData.length > 0) {
        return res.status(200).json({
          rtnCode: "0001",
          rtnMsg: "此聯絡人電子信箱已註冊，請輸入其他電子信箱。",
        })
      }

      // @檢驗機關註冊狀況
      // 檢察機關名稱和簡稱是否已經存在
      const instNameData =
        await repository.institutionsRepo.findAllInstitutions(
          { name: institutionName },
          transaction
        )
      if (instNameData.length > 0 && instNameData[0].abbr != institutionAbbr) {
        if (!transactionCommitted) {
          // 只有當交易尚未提交時才回滾
          await transaction.rollback()
        }
        return res.status(200).json({
          rtnCode: "0003",
          rtnMsg: `該機關簡稱輸入錯誤，請改為${instNameData[0].abbr}`,
        })
      }
      // 創建機關
      const query = { name: institutionName, abbr: institutionAbbr }
      let institution = await repository.institutionsRepo.findAllInstitutions(
        query,
        transaction
      )
      let institutions = institution.map((inst) => inst.get({ plain: true }))

      let institutionId
      if (institutions.length > 0) {
        institutionId = institutions[0].institution_id
      } else {
        const institutionData = {
          name: institutionName,
          abbr: institutionAbbr,
          unit_type_id: userTypeId,
          is_supplier: isSupplier,
        }
        institution = await repository.institutionsRepo.createInstitution(
          institutionData,
          transaction
        )
        institutionId = institution.institution_id
      }

      // 檢查該機關是否已經被註冊過
      const existingUserProfile =
        await repository.userProfilesRepo.findUserProfiles(
          { institution_id: institutionId },
          transaction
        )
      if (existingUserProfile.length > 0) {
        if (!transactionCommitted) {
          // 只有當交易尚未提交時才回滾
          await transaction.rollback()
        }
        return res.status(200).json({
          rtnCode: "0003",
          rtnMsg: "該機關已經有窗口，無法重複註冊。",
        })
      }

      // @寄送驗證信
      const verifyData = await repository.verifyLinksRepo.findVerificationLinks(
        {
          username,
          latest: true,
        }
      )
      const token = crypto.randomUUID()
      const expireAt = getLaterDate(new Date(), 1, "hour")
      const link =
        process.env.SERVICE_HOST_FRONTEND + "/userlogin/?verifyCode=" + token
      const subject = `${process.env.SERVICE_NAME}會員信箱驗證`
      const htmlContent = `
          <p>Dear ${contactPersonName}, </p>
          <h1>請點擊下方連結，以完成您的信箱驗證：</h1>
          <h1><a href="${link}">驗證連結</a></h1>
          <p>此連結將於 ${expireAt.toLocaleString("zh-TW", {
            timeZone: "Asia/Taipei",
          })} 後失效</p>`
      if (
        userData &&
        verifyData.length !== 0 &&
        verifyData[0].tokenStatus !== 1
      ) {
        // 更新舊驗證碼
        await repository.verifyLinksRepo.updateVerificationLink(
          {
            username,
            token: verifyData[0].token,
            newStatus: 2, // invalid
          },
          transaction
        )
        // 產生新驗證碼
        await repository.verifyLinksRepo.createVerificationLink(
          {
            username,
            token,
            statusCode: 0, // active
            expireAt,
          },
          transaction
        )
        // 寄送驗證信
        sendEmailBackground(contactEmail, subject, htmlContent, next)

        await transaction.commit()
        transactionCommitted = true

        return res.status(200).json({
          rtnCode: "0002",
          rtnMsg: `已重新發送驗證信箱連結，請前往您的信箱點擊驗證連結完成信箱驗證才能登入，連結將於${expireAt}後失效。`,
          data: isDev
            ? {
                expireAt,
                token,
              }
            : {
                expireAt,
              },
        })
      }
      sendEmailBackground(contactEmail, subject, htmlContent, next)
      await repository.verifyLinksRepo.createVerificationLink(
        {
          username,
          token,
          statusCode: 0, // active
          expireAt,
        },
        transaction
      )

      // @寫入註冊資料
      // 創建用戶
      const newUserData = {
        username,
        password_hash: await bcrypt.hash(password, 10),
        account_status: 1, // 驗證email後才啟用
      }
      const userCreationResult =
        await repository.frontendUsersRepo.createFrontendUser(
          newUserData,
          transaction
        )

      // 創建用戶詳細資料
      const userProfileData = {
        user_id: userCreationResult.user_id,
        unit_type_id: userTypeId,
        institution_id: institutionId,
        contact_person_name: contactPersonName,
        contact_phone_office: contactPhoneOffice,
        contact_phone_mobile: contactPhoneMobile,
        contact_department: contactDepartment,
        contact_position: contactPosition,
        contact_email: contactEmail,
      }
      await repository.userProfilesRepo.createUserProfile(
        userProfileData,
        transaction
      )

      await transaction.commit()
      transactionCommitted = true

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "註冊成功，請至您的註冊Email收取驗證信並完成驗證。",
      })
    } catch (err) {
      if (!transactionCommitted) {
        // 只有當交易尚未提交時才回滾
        await transaction.rollback()
      }
      err.code = "REGISTER_REQUESTER_ERROR"
      next(err)
    }
  },
  // -需求端驗證信箱
  registerVerify: async (req, res, next) => {
    const transaction = await db.sequelize.transaction()
    let transactionCommitted = false
    try {
      // @接收參數
      const { verifyCode: token } = validateInput([
        {
          labelName: "驗證碼",
          inputName: "verifyCode",
          inputValue: req.body.verifyCode,
          validateWay: "isString",
          isRequired: true,
        },
      ])

      // @檢查 token 是否存在
      const verifyData = (
        await repository.verifyLinksRepo.findVerificationLinks({
          token,
          latest: true,
        })
      )[0]
      if (!verifyData) {
        return res.status(200).json({
          rtnCode: "0001",
          rtnMsg: "驗證碼無效。",
        })
      }

      // @檢查 token 是否已經被使用
      if (verifyData.tokenStatus === 1) {
        return res.status(200).json({
          rtnCode: "0002",
          rtnMsg: "信箱已完成驗證，請前往首頁登入。",
        })
      }

      // @檢查 token 是否已經失效
      if (verifyData.tokenStatus === 2) {
        return res.status(200).json({
          rtnCode: "0003",
          rtnMsg: "驗證連結已失效，請重新申請。",
        })
      }

      // @檢驗 token 是否過期
      if (new Date(verifyData.expireAt) < new Date()) {
        return res.status(200).json({
          rtnCode: "0004",
          rtnMsg: "驗證連結已過期，請重新申請。",
        })
      }

      // @更新 token 狀態
      const username = verifyData.username
      await repository.verifyLinksRepo.updateVerificationLink(
        {
          username: username,
          token,
          newStatus: 1,
        },
        transaction
      )

      // @更新 user 狀態
      await repository.frontendUsersRepo.updateFrontendUserByEmail(
        username,
        {
          account_status: 0,
        },
        transaction
      )

      await transaction.commit()
      transactionCommitted = true

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "信箱已完成驗證，請前往首頁登入。",
      })
    } catch (err) {
      if (!transactionCommitted) {
        // 只有當交易尚未提交時才回滾
        await transaction.rollback()
      }
      err.code = "signupVerify error"
      next(err)
    }
  },
  // -登入
  login: async (req, res, next) => {
    const genJwtToken = (userData, clientIp) => {
      const jwtSignOptions = userData
      if (process.env.IP_CHECK === "true") jwtSignOptions.clientIp = clientIp
      return jwt.sign(jwtSignOptions, process.env.JWT_SECRET, {
        expiresIn: process.env.TOKEN_EXPIRE_TIME,
      })
    }
    const genCookieOptions = () => {
      const cookieExpireTime =
        process.env.TOKEN_EXPIRE_TIME.slice(0, -1) * 3600000 //tokenExpireTime * 1hr

      return {
        httpOnly: !isDev,
        secure: !isDev,
        sameSite: "strict",
        maxAge: cookieExpireTime,
      }
    }
    const transaction = await db.sequelize.transaction()
    let transactionCommitted = false
    try {
      // @接收參數
      const { username, password } = validateInput([
        {
          labelName: "帳號",
          inputName: "username",
          inputValue: req.body.username,
          validateWay: "isString",
          isRequired: true,
        },
        {
          labelName: "密碼",
          inputName: "password",
          inputValue: req.body.password,
          validateWay: "isString",
          isRequired: true,
        },
      ])

      // @確認帳號狀態
      // 確認是否註冊
      const userData =
        await repository.frontendUsersRepo.findFrontendUserByEmail({
          username,
          transaction,
        })
      if (!userData) {
        return res.status(200).json({
          rtnCode: "0001",
          rtnMsg: "此帳號尚未註冊。",
        })
      }

      // 確認是否啟用
      if (userData.account_status === 1) {
        await repository.frontendLoginHistoriesRepo.createFrontUserLoginHistory(
          {
            username,
            loginStatus: 1,
          },
          transaction
        )
        await transaction.commit()
        transactionCommitted = true

        return res.status(200).json({
          rtnCode: "0002",
          rtnMsg: "此帳號尚未完成驗證。",
        })
      }

      // @檢查密碼
      const isPasswordMatch = await bcrypt.compare(
        password,
        userData.password_hash
      )
      // 密碼錯誤
      if (!isPasswordMatch) {
        await repository.frontendLoginHistoriesRepo.createFrontUserLoginHistory(
          {
            username,
            loginStatus: 1,
          },
          transaction
        )
        await transaction.commit()
        transactionCommitted = true

        return res.status(200).json({
          rtnCode: "0003",
          rtnMsg: "密碼錯誤。",
        })
      }
      // 密碼正確
      await repository.frontendLoginHistoriesRepo.createFrontUserLoginHistory(
        {
          username,
          loginStatus: 0,
        },
        transaction
      )

      // @找用戶的機關資訊
      const userProfiles =
        await repository.userProfilesRepo.findUserProfileByUserId(
          userData.user_id,
          transaction
        )
      const institutionID = userProfiles.institution_id
      const institutionData =
        await repository.institutionsRepo.findInstitutionById(
          institutionID,
          transaction
        )

      await transaction.commit()
      transactionCommitted = true

      // @設定輸出資訊
      const plainProfiles = userProfiles.get({ plain: true })
      const plainUserData = userData.get({ plain: true })
      delete plainUserData.password_hash
      const clientIp =
        req.headers["x-forwarded-for"] || req.socket.remoteAddress || null
      const token = genJwtToken(plainUserData, clientIp)
      const cookieOptions = genCookieOptions()

      return res
        .cookie("frontendAccessToken", token, cookieOptions)
        .status(200)
        .json({
          rtnCode: "0000",
          rtnMsg: "登入成功。",
          data: isDev
            ? {
                token,
                userData: snakeToCamel(plainUserData),
                userProfiles: snakeToCamel(plainProfiles),
                institutionData: snakeToCamel(
                  institutionData.get({ plain: true })
                ),
              }
            : {
                userData: {
                  userId: plainUserData.user_id,
                  username: plainUserData.username,
                },
                userProfiles: {
                  unitTypeId: plainProfiles.unit_type_id,
                  contactPersonName: plainProfiles.contact_person_name,
                  contactPhoneOffice: plainProfiles.contact_phone_office,
                  contactPhoneMobile: plainProfiles.contact_phone_mobile,
                  contactEmail: plainProfiles.contact_email,
                  contactDepartment: plainProfiles.contact_department,
                  contactPosition: plainProfiles.contact_position,
                },
                institutionData: {
                  name: institutionData.name,
                  isSupplier: institutionData.is_supplier,
                },
              },
        })
    } catch (err) {
      if (!transactionCommitted) {
        // 只有當交易尚未提交時才回滾
        await transaction.rollback()
      }
      err.code = "LOGIN_ERROR"
      next(err)
    }
  },
  // -登出
  logout: async (req, res, next) => {
    try {
      // 清除 accessToken cookie
      const cookieOptions = {
        httpOnly: true,
        secure: !isDev,
        sameSite: "strict",
        maxAge: 0, // 設置 maxAge 為 0 使 cookie 立即過期
        expires: new Date(0),
      }

      res.cookie("frontendAccessToken", "", cookieOptions)

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "登出成功",
      })
    } catch (err) {
      err.code = "LOGOUT_ERROR"
      next(err)
    }
  },
  // -忘記密碼
  forgotPassword: async (req, res, next) => {
    const transaction = await db.sequelize.transaction()
    let transactionCommitted = false
    try {
      // @接收參數
      const { username } = validateInput([
        {
          labelName: "信箱",
          inputName: "username",
          inputValue: req.body.username,
          validateWay: "isString",
          isRequired: true,
        },
      ])

      // @檢驗 username 註冊狀況
      let userData = await repository.frontendUsersRepo.findFrontendUserByEmail(
        {
          username,
          transaction,
        }
      )
      userData = userData.get({ plain: true })
      // 信箱未註冊
      if (!userData) {
        return res.status(200).json({
          rtnCode: "0001",
          rtnMsg: "此帳號未註冊。",
        })
      }
      // 信箱已註冊，但信箱未驗證
      if (
        userData &&
        userData.account_status !== 0 // 未驗證
      ) {
        await transaction.commit()
        transactionCommitted = true

        return res.status(200).json({
          rtnCode: "0002",
          rtnMsg: "您的帳號尚未驗證。",
        })
      }

      // @搜尋聯絡人email
      // 取得聯絡email
      const userDetail =
        await repository.userProfilesRepo.findUserProfileByUserId(
          userData.user_id,
          transaction
        )

      // @寄送驗證碼
      const token = crypto.randomUUID()
      const expireAt = getLaterDate(new Date(), 1, "hour")
      const link =
        process.env.SERVICE_HOST_FRONTEND + "/resetpassword?token=" + token
      const mailOptions = {
        from: process.env.MAIL_AC,
        to: userDetail.contact_email,
        subject: `${process.env.SERVICE_NAME}-重設密碼連結`,
        html: `
            <p>${username} 您好</p>
            <h1>請點擊以下連結完成您的密碼重設</h1>
            <h1><a href="${link}">重設密碼連結</a></h1>
            <p>此連結將於 ${expireAt.toLocaleString("zh-TW", {
              timeZone: "Asia/Taipei",
            })} 後失效</p>
          `,
      }
      if (process.env.DEV_CC === "true") {
        mailOptions.bcc = process.env.DEVELOPER_EMAIL
      }
      const options = {
        MAIL_AC: process.env.MAIL_AC,
        MAIL_PW: process.env.MAIL_PW,
      }
      // if (!isDev) {
      //   options.PROXY_TYPE = "socks5"
      //   options.TRANSPORTS_PROXY = process.env.TRANSPORTS_PROXY
      // }
      const verifyData = await repository.verifyLinksRepo.findVerificationLinks(
        {
          username,
          latest: true,
        }
      )
      // 已寄送過驗證信
      if (
        verifyData.length !== 0 &&
        verifyData[0].tokenStatus === 0 // 未驗證
      ) {
        // 更新舊驗證碼
        await repository.verifyLinksRepo.updateVerificationLink(
          {
            username,
            token: verifyData[0].token,
            newStatus: 2, // invalid
          },
          transaction
        )

        // 產生新驗證碼
        await repository.verifyLinksRepo.createVerificationLink(
          {
            username,
            token,
            statusCode: 0, // active
            expireAt,
          },
          transaction
        )

        // 寄送驗證信
        try {
          await sendMail(mailOptions, options)
        } catch (error) {
          const err = new ThirdPartyApiError(`Email寄送失敗。 ${error}`)
          return next(err)
        }

        await transaction.commit()
        transactionCommitted = true

        return res.status(200).json({
          rtnCode: "0000",
          rtnMsg: `已重新發送重設密碼連結到您的信箱，請前往您的信箱並點擊該連結來重設您的密碼。該連結將於${expireAt.toLocaleString(
            "zh-TW",
            { timeZone: "Asia/Taipei" }
          )}後失效。`,
          data: isDev
            ? {
                expireAt,
                token,
              }
            : {
                expireAt,
              },
        })
      }

      // 沒寄過驗證信
      // 產生新驗證碼
      await repository.verifyLinksRepo.createVerificationLink(
        {
          username,
          token,
          statusCode: 0, // active
          expireAt,
        },
        transaction
      )

      // 寄送驗證信
      try {
        await sendMail(mailOptions, options)
      } catch (error) {
        const err = new ThirdPartyApiError(`Email寄送失敗。 ${error}`)
        return next(err)
      }

      await transaction.commit()
      transactionCommitted = true

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: `重設密碼連結已發送至您的電子信箱，請前往您的信箱點擊該連結來完成密碼重設。請注意，該連結將於${expireAt.toLocaleString(
          "zh-TW",
          { timeZone: "Asia/Taipei" }
        )}後失效。`,
        data: isDev
          ? {
              expireAt,
              token,
            }
          : {
              expireAt,
            },
      })
    } catch (err) {
      if (!transactionCommitted) {
        // 只有當交易尚未提交時才回滾
        await transaction.rollback()
      }
      err.code = "FORGOT_PASSWORD_ERROR"
      next(err)
    }
  },
  // -重設密碼
  resetPassword: async (req, res, next) => {
    const transaction = await db.sequelize.transaction()
    let transactionCommitted = false
    try {
      // @接收參數
      const { verifyCode: token, password } = validateInput([
        {
          labelName: "驗證碼",
          inputName: "verifyCode",
          inputValue: req.body.verifyCode,
          validateWay: "isUUID",
          isRequired: true,
        },
        {
          labelName: "密碼",
          inputName: "password",
          inputValue: req.body.password,
          validateWay: "isString",
          isRequired: true,
          patterns: [
            "^(?=.*[A-Za-z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$",
          ],
          minLength: 7,
          customMessages: {
            "string.pattern.base":
              "密碼必須包含至少8個字符，且包含英文字母、數字和符號。",
            "string.min": "密碼長度至少需要8個字符。",
          },
        },
      ])

      // @檢查 token
      // 檢查 token 是否存在
      const verifyData = (
        await repository.verifyLinksRepo.findVerificationLinks({
          token,
          latest: true,
        })
      )[0]
      if (!verifyData) {
        return res.status(200).json({
          rtnCode: "0001",
          rtnMsg: "該驗證碼無效。",
        })
      }

      // 檢查 token 是否已經被使用
      if (verifyData.tokenStatus === 1) {
        return res.status(200).json({
          rtnCode: "0002",
          rtnMsg: "密碼已完成重設，請前往首頁登入。",
        })
      }

      // 檢查 token 是否已經失效
      if (verifyData.tokenStatus === 2) {
        return res.status(200).json({
          rtnCode: "0003",
          rtnMsg: "重設密碼連結已失效，請重新申請。",
        })
      }

      // 檢驗 token 是否過期
      if (new Date(verifyData.expireAt) < new Date()) {
        return res.status(200).json({
          rtnCode: "0004",
          rtnMsg: "重設密碼連結已過期，請重新申請。",
        })
      }

      // 更新 token 狀態
      await repository.verifyLinksRepo.updateVerificationLink(
        {
          email: verifyData.username,
          token,
          newStatus: 1,
        },
        transaction
      )

      // @新密碼加密
      const passwordHashed = await bcrypt.hash(password, 10)

      // @更新密碼
      await repository.frontendUsersRepo.updateFrontendUserByEmail(
        verifyData.username,
        { password_hash: passwordHashed },
        transaction
      )

      await transaction.commit()
      transactionCommitted = true

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "重設密碼已完成，請前往首頁登入。",
      })
    } catch (err) {
      if (!transactionCommitted) {
        // 只有當交易尚未提交時才回滾
        await transaction.rollback()
      }
      err.code = "RESET_PASSWORD_ERROR"
      next(err)
    }
  },
  // -更新密碼
  updatePassword: async (req, res, next) => {
    const transaction = await db.sequelize.transaction()
    let transactionCommitted = false
    try {
      // @接收參數
      const { oldPassword: op, newPassword: np } = validateInput([
        {
          labelName: "舊密碼",
          inputName: "oldPassword",
          inputValue: req.body.oldPassword,
          validateWay: "isString",
          isRequired: true,
          patterns: [
            "^(?=.*[A-Za-z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$",
          ],
          minLength: 7,
          customMessages: {
            "string.pattern.base":
              "密碼必須包含至少8個字符，且包含英文字母、數字和符號。",
            "string.min": "密碼長度至少需要8個字符。",
          },
        },
        {
          labelName: "新密碼",
          inputName: "newPassword",
          inputValue: req.body.newPassword,
          validateWay: "isString",
          isRequired: true,
          patterns: [
            "^(?=.*[A-Za-z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$",
          ],
          minLength: 7,
          customMessages: {
            "string.pattern.base":
              "密碼必須包含至少8個字符，且包含英文字母、數字和符號。",
            "string.min": "密碼長度至少需要8個字符。",
          },
        },
      ])

      // @取得當前使用者ID
      const userId = req.user.userId

      // @取得當前使用者密碼
      let userData = await repository.frontendUsersRepo.findFrontendUserById(
        userId,
        transaction
      )
      userData = userData.get({ plain: true })

      // @比對舊密碼是否正確
      const isPasswordMatch = await bcrypt.compare(op, userData.password_hash)
      if (!isPasswordMatch) {
        await transaction.commit()
        transactionCommitted = true

        return res.status(200).json({
          rtnCode: "0001",
          rtnMsg: "舊密碼錯誤。",
        })
      }

      // @新密碼加密
      const passwordHashed = await bcrypt.hash(np, 10)

      // @更新密碼
      await repository.frontendUsersRepo.updateFrontendUserById(
        userId,
        { password_hash: passwordHashed },
        transaction
      )

      await transaction.commit()
      transactionCommitted = true

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "密碼已更新",
      })
    } catch (err) {
      if (!transactionCommitted) {
        // 只有當交易尚未提交時才回滾
        await transaction.rollback()
      }
      err.code = "UPDATE_PASSWORD_ERROR"
      next(err)
    }
  },
  // -使用者資訊-查看
  getUserInfo: async (req, res, next) => {
    function formatUserData(data) {
      const userProfile = data.UserProfiles[0] // 假設 UserProfiles 只有一個元素
      const unitType = userProfile.UnitType.name
      const institution = userProfile.Institution

      return {
        userId: data.user_id,
        usernmae: data.username,
        accountStatus: data.account_status,
        basic: {
          unitTypeName: unitType,
          institutionName: institution.name,
          institutionAbbr: institution.abbr,
        },
        contactInfo: {
          contactPersonName: userProfile.contact_person_name,
          contactPhoneOffice: userProfile.contact_phone_office,
          contactPhoneMobile: userProfile.contact_phone_mobile,
          contactDepartment: userProfile.contact_department,
          contactPosition: userProfile.contact_position,
          contactEmail: userProfile.contact_email,
        },
      }
    }
    const transaction = await db.sequelize.transaction()
    let transactionCommitted = false
    try {
      // @取得當前使用者ID
      const userId = req.user.userId

      // @取得使用者詳細資訊
      const userData =
        await repository.frontendUsersRepo.findFrontendUserProfileById(
          userId,
          transaction
        )
      if (!userData) {
        await transaction.commit()
        transactionCommitted = true

        return res.status(200).json({
          rtnCode: "0001",
          rtnMsg: "用戶未找到",
        })
      }

      // @格式化輸出
      const formattedData = formatUserData(userData)

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "查詢成功",
        data: snakeToCamel(formattedData),
      })
    } catch (err) {
      if (!transactionCommitted) {
        // 只有當交易尚未提交時才回滾
        await transaction.rollback()
      }
      err.code = "GET_USER_INFO_ERROR"
      next(err)
    }
  },
  // -使用者資訊-修改
  updateUserInfo: async (req, res, next) => {
    const transaction = await db.sequelize.transaction()
    let transactionCommitted = false
    try {
      // @接收參數
      const {
        contactPersonName, // 聯絡人姓名
        contactPhoneOffice, // 公務電話
        contactPhoneMobile, // 公務手機
        contactDepartment, // 聯絡人部門
        contactPosition, // 聯絡人職稱
        contactEmail, // 電子信箱
      } = req.body

      // @驗證參數
      validateInput([
        {
          labelName: "聯絡人姓名",
          inputName: "contactPersonName",
          inputValue: contactPersonName,
          validateWay: "isString",
          isRequired: false,
        },
        {
          labelName: "公務電話",
          inputName: "contactPhoneOffice",
          inputValue: contactPhoneOffice,
          validateWay: "isString",
          isRequired: false,
        },
        {
          labelName: "聯絡人電子信箱",
          inputName: "contactEmail",
          inputValue: contactEmail,
          validateWay: "email",
          isRequired: false,
        },
        {
          labelName: "公務手機",
          inputName: "contactPhoneMobile",
          inputValue: contactPhoneMobile,
          validateWay: "isString",
          isRequired: false,
        },
        {
          labelName: "聯絡人部門",
          inputName: "contactDepartment",
          inputValue: contactDepartment,
          validateWay: "isString",
          isRequired: false,
        },
        {
          labelName: "聯絡人職稱",
          inputName: "contactPosition",
          inputValue: contactPosition,
          validateWay: "isString",
          isRequired: false,
        },
      ])

      // @取得當前使用者 ID
      const userId = req.user.userId

      // @檢查EMAIL是否重複
      if (contactEmail) {
        const emailData = await repository.userProfilesRepo.findUserProfiles(
          { contact_email: contactEmail },
          transaction
        )
        if (Array.isArray(emailData) && emailData.length > 0) {
          return res.status(200).json({
            rtnCode: "0001",
            rtnMsg: "此聯絡人電子信箱已註冊，請輸入其他電子信箱。",
          })
        }
      }

      // @更新 UserProfiles 表的資料
      const profileData = {}
      if (contactPersonName) {
        profileData.contact_person_name = contactPersonName
      }
      if (contactPhoneOffice) {
        profileData.contact_phone_office = contactPhoneOffice
      }
      if (contactPhoneMobile) {
        profileData.contact_phone_mobile = contactPhoneMobile
      }
      if (contactDepartment) {
        profileData.contact_department = contactDepartment
      }
      if (contactPosition) {
        profileData.contact_position = contactPosition
      }
      if (contactEmail) {
        profileData.contact_email = contactEmail
      }

      if (Object.keys(profileData).length > 0) {
        await repository.userProfilesRepo.updateUserProfileByUserId(
          userId,
          profileData,
          transaction
        )
      }

      await transaction.commit()
      transactionCommitted = true

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "修改成功",
      })
    } catch (err) {
      if (!transactionCommitted) {
        // 只有當交易尚未提交時才回滾
        await transaction.rollback()
      }
      err.code = "UPDATE_USER_INFO_ERROR"
      next(err)
    }
  },
  // -重寄驗證信
  resendVerify: async (req, res, next) => {
    const transaction = await db.sequelize.transaction()
    let transactionCommitted = false
    try {
      // @接收參數
      const {
        username, // 帳號
        contactEmail, // 聯絡人電子信箱
      } = req.body

      // @驗證輸入
      validateInput([
        {
          labelName: "帳號",
          inputName: "username",
          inputValue: username,
          validateWay: "isString",
          isRequired: true,
        },
        {
          labelName: "聯絡人Email",
          inputName: "contactEmail",
          inputValue: contactEmail,
          validateWay: "email",
          isRequired: true,
        },
      ])

      // @檢驗 username, email 註冊狀況
      const userData = await repository.frontendUsersRepo.usernameUnique({
        username,
        transaction,
      })
      const emailData = await repository.userProfilesRepo.findUserProfiles(
        { contact_email: contactEmail },
        transaction
      )
      if (userData && userData.account_status === 0) {
        await transaction.commit()
        transactionCommitted = true

        return res.status(200).json({
          rtnCode: "0001",
          rtnMsg: "此帳號已註冊成功，請直接登入。",
        })
      }
      if (userData && userData.account_status === -1) {
        await transaction.commit()
        transactionCommitted = true

        return res.status(200).json({
          rtnCode: "0002",
          rtnMsg: "此帳號已被系統管理員刪除，請註冊新帳號。",
        })
      }
      if (emailData[0].user_id !== userData.user_id) {
        return res.status(200).json({
          rtnCode: "0003",
          rtnMsg: "帳號或電子信箱輸入錯誤，請重新輸入。",
        })
      }

      // @檢查是否是需求端使用者
      const userProfiles = await repository.userProfilesRepo.findUserProfiles(
        { user_id: userData.user_id },
        transaction
      )
      const institutionID = userProfiles[0].institution_id
      const institutionData =
        await repository.institutionsRepo.findInstitutionById(institutionID)
      if (institutionData.is_supplier === true) {
        await transaction.commit()
        transactionCommitted = true
        return res.status(200).json({
          rtnCode: "0004",
          rtnMsg: "供給端使用者不可重寄驗證信，請等待後台管理員驗證帳號。",
        })
      }

      // @重新寄送驗證信
      const verifyData = await repository.verifyLinksRepo.findVerificationLinks(
        {
          username,
          latest: true,
        }
      )
      const token = crypto.randomUUID()
      const expireAt = getLaterDate(new Date(), 1, "hour")
      const link =
        process.env.SERVICE_HOST_FRONTEND + "/userlogin/?verifyCode=" + token
      const subject = `${process.env.SERVICE_NAME}-帳號信箱驗證連結`
      const htmlContent = `
          <p>${username} 您好</p>
          <h1>請點擊以下連結完成您的信箱驗證</h1>
          <h1><a href="${link}">驗證連結</a></h1>
          <p>此連結將於 ${expireAt.toLocaleString("zh-TW", {
            timeZone: "Asia/Taipei",
          })} 後失效</p>`
      if (
        userData &&
        verifyData.length !== 0 &&
        verifyData[0].tokenStatus !== 1
      ) {
        // 更新舊驗證碼
        await repository.verifyLinksRepo.updateVerificationLink(
          {
            username,
            token: verifyData[0].token,
            newStatus: 2, // invalid
          },
          transaction
        )
      }

      // 產生新驗證碼
      await repository.verifyLinksRepo.createVerificationLink(
        {
          username,
          token,
          statusCode: 0, // active
          expireAt,
        },
        transaction
      )
      // 寄送驗證信
      sendEmailBackground(contactEmail, subject, htmlContent, next)

      await transaction.commit()
      transactionCommitted = true

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: `已重新發送驗證信箱連結，請前往您的信箱點擊驗證連結完成信箱驗證才能登入，連結將於${expireAt}後失效。`,
        data: isDev
          ? {
              expireAt,
              token,
            }
          : {
              expireAt,
            },
      })
    } catch (err) {
      if (!transactionCommitted) {
        // 只有當交易尚未提交時才回滾
        await transaction.rollback()
      }
      err.code = "RESEND_VERIFY_ERROR"
      next(err)
    }
  },
}
