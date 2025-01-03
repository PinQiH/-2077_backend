const passport = require("passport")
const passportJWT = require("passport-jwt")
const JWTStrategy = passportJWT.Strategy
const ExtractJWT = passportJWT.ExtractJwt
const repository = require("@repository")
const { fetchLocalApiData } = require("@utils/localApiService")

const jwtOptions = {
  jwtFromRequest: ExtractJWT.fromExtractors([
    (req) => {
      const backendPaths = [
        "/bo",
        "/members",
        "/backend-users",
        "/roles",
        "/auth",
        "/dashboard",
        "/admin",
      ]
      if (backendPaths.some((path) => req.path.startsWith(path))) {
        return req && req.cookies ? req.cookies["backendAccessToken"] : null
      } else {
        return req && req.cookies ? req.cookies["frontendAccessToken"] : null
      }
    },
  ]),
  secretOrKey: process.env.JWT_SECRET,
  passReqToCallback: true,
}

passport.use(
  new JWTStrategy(jwtOptions, async (req, jwtPayload, done) => {
    try {
      let userData
      let institutionData
      if (jwtPayload.backendUserAccount) {
        userData =
          await repository.backendUsersRepo.doesBackendUserAccountExist(
            jwtPayload.backendUserAccount
          )
      } else if (jwtPayload.user_id) {
        userData = await repository.frontendUsersRepo.findFrontendUserById(
          jwtPayload.user_id
        )

        // 將 institutionData 添加到 userData 中
        const userProfiles =
          await repository.userProfilesRepo.findUserProfileByUserId(
            jwtPayload.user_id
          )
        const institutionID = userProfiles.institution_id
        institutionData = await repository.institutionsRepo.findInstitutionById(
          institutionID
        )
      } else {
        return done(null, false)
      }

      if (!userData) {
        return done(null, false)
      }

      // 在JWT Payload中添加用戶類型（前台或後台）
      const userType = jwtPayload.backendUserAccount ? "backend" : "frontend"

      return done(null, { ...jwtPayload, userType, institutionData })
    } catch (err) {
      return done(err)
    }
  })
)

module.exports = passport
