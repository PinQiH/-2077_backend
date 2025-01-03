const db = require("@models")
const { Op } = require("sequelize")

module.exports = {
  async createUserProfile(data, transaction = null) {
    await db.UserProfiles.create(data, { transaction })
  },

  async createMultipleUserProfiles(dataArray, transaction = null) {
    await db.UserProfiles.bulkCreate(dataArray, { transaction })
  },

  async updateUserProfile(profileId, data, transaction = null) {
    await db.UserProfiles.update(data, {
      where: { profile_id: profileId },
      transaction,
    })
  },

  async updateUserProfileByUserId(UserId, data, transaction = null) {
    await db.UserProfiles.update(data, {
      where: { user_id: UserId },
      transaction,
    })
  },

  async findUserProfiles(query = {}, transaction = null) {
    const profiles = await db.UserProfiles.findAll({
      where: query,
      include: [
        {
          model: db.Frontend_users,
          required: true,
        },
      ],
      transaction,
    })
    return profiles
  },

  async findUserProfileById(profileId, transaction = null) {
    const profile = await db.UserProfiles.findOne({
      where: { profile_id: profileId },
      transaction,
    })
    return profile
  },

  async findUserProfileByUserId(userId, transaction = null) {
    const profile = await db.UserProfiles.findOne({
      where: { user_id: userId },
      transaction,
    })
    return profile
  },

  async deleteUserProfile(profileId, transaction = null) {
    await db.UserProfiles.destroy({
      where: { profile_id: profileId },
      transaction,
    })
  },
}
