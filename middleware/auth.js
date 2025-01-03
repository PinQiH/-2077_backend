const passport = require("../config/passport")
const utilHelper = require("@utils/utilHelper")
const { PermissionError } = require("@utils/error")
const { validateInput } = require("@utils/validators")
const { getRedisKey } = require("@utils/redisSetter")
const isDevelopment = process.env.NODE_ENV === "development"
const getClientIp = (req) => {
  const xForwardedFor = req.headers["x-forwarded-for"]
  if (xForwardedFor) {
    const list = xForwardedFor.split(",").map((ip) => ip.trim())
    return list[0]
  }
  return req.socket.remoteAddress
}

const authenticated = (userType) => async (req, res, next) => {
  passport.authenticate("jwt", { session: false }, async (err, user, info) => {
    try {
      if (err || !user) {
        const error = new PermissionError("請先登入後再使用")
        error.code = "AUTH_REQUIRED"
        return next(error)
      }

      if (user.userType !== userType) {
        const error = new PermissionError("無效的用戶身份")
        error.code = "INVALID_USER_TYPE"
        return next(error)
      }

      if (process.env.IP_CHECK === "true") {
        const clientIp = getClientIp(req)
        if (user.clientIp !== clientIp) {
          const error = new PermissionError("IP 地址不匹配")
          error.code = "IP_MISMATCH"
          return next(error)
        }
      }

      if (user.accountStatus === 1) {
        const error = new PermissionError(
          "您的帳號狀態為“禁用”，請聯絡管理員。"
        )
        error.code = "BACKEND_ACCOUNT_DISABLED"
        throw error
      }

      if (user.account_status === 1) {
        const error = new PermissionError(
          "您的帳號狀態為“禁用”，請聯絡管理員。"
        )
        error.code = "FRONTEND_ACCOUNT_DISABLED"
        throw error
      }

      let formattedUserData
      if (user.backendUserAccount) {
        formattedUserData = {
          email: user.backendUserAccount,
          userEmail: user.email,
          accountStatus: user.accountStatus,
        }
      } else if (user.user_id) {
        formattedUserData = {
          userId: user.user_id,
          username: user.username,
          email: user.email,
          accountStatus: user.account_status,
          institutionData: user.institutionData.get({ plain: true }),
        }
      }

      req.user = formattedUserData
      return next()
    } catch (err) {
      err.code = err.code || "AUTH_ERROR"
      return next(err)
    }
  })(req, res, next)
}

const checkPermission = (permissionName, selfUserPass = false) => {
  return async (req, res, next) => {
    const { permissions, userId } = req.user
    const { userId: paramsUserId } = req.params
    if (selfUserPass && userId && paramsUserId && userId === paramsUserId)
      return next()
    const userPermissionNames = permissions.map((perm) => perm.permissionName)
    const userPermissionsSet = new Set(userPermissionNames)
    userPermissionsSet.has(permissionName)
      ? next()
      : next(new PermissionError(`您沒有權限執行此操作`))
  }
}

const hasAnyOfRoles = (requiredRoleNames) => {
  return async (req, res, next) => {
    const { roles } = req.user
    const userRoleNames = roles.map((role) => role.roleName)
    const userRoleSet = new Set(userRoleNames)

    // 檢查用戶是否有任何所需的角色
    const hasRequiredRole = requiredRoleNames.some((role) =>
      userRoleSet.has(role)
    )

    hasRequiredRole ? next() : next(new PermissionError(`您沒有權限執行此操作`))
  }
}

const authenticatedWithoutDuty = async (req, res, next) => {
  if (process.env.NODE_ENV === "production") {
    try {
      const userId = req.headers["x-user-id"]
      if (!userId) {
        const error = new PermissionError("請先登入後再使用")
        return next(error)
      }
      const user = await getRedisKey(userId)

      if (!user) {
        const error = new PermissionError("請先登入後再使用")
        return next(error)
      }

      if (process.env.CHECK_IP === "true") {
        const rawClientIp = req.headers["x-forwarded-for"]
        const clientIp = utilHelper.getCleanedIP(rawClientIp)
        if (user.clientIp !== clientIp) {
          const error = new PermissionError("IP 地址不匹配")
          return next(error)
        }
      }

      req.user = user
      return next()
    } catch (err) {
      return next(err)
    }
  } else {
    passport.authenticate("jwt", { session: false }, (err, user, info) => {
      if (err || !user) {
        const error = new PermissionError("請先登入後再使用")
        return next(error)
      }
      if (process.env.CHECK_IP === "true") {
        const rawClientIp = req.headers["x-forwarded-for"]
        const clientIp = utilHelper.getCleanedIP(rawClientIp)
        if (user.clientIp !== clientIp) {
          const error = new PermissionError("IP 地址不匹配")
          return next(error)
        }
      }
      req.user = user
      return next()
    })(req, res, next)
  }
}

const checkBOAdminAccess = async (req, res, next) => {
  // 取得當前使用者帳號
  const accountStatus = req.user.accountStatus

  // 檢查帳號狀態是否為 -1，此處假設 -1 表示非管理員
  if (accountStatus !== -1) {
    throw new PermissionError("權限不符，僅網站管理員(BOAdmin)可使用此區功能")
  }

  // 如果檢查通過，則繼續執行後續中間件
  next()
}

module.exports = {
  authenticated,
  checkPermission,
  hasAnyOfRoles,
  authenticatedWithoutDuty,
  checkBOAdminAccess,
}
