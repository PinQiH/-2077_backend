const apiV1Routes = require("./api.js")
const apiV1Routes_inner = require("./inner-api.js")
const apiV1Routes_user_management = require("./user-management-api.js")

module.exports = (app) => {
  app.use("/api/v1", apiV1Routes)
  app.use("/api/v1/inner", apiV1Routes_inner)
  app.use("/api/v1", apiV1Routes_user_management)
}
