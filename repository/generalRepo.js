const db = require("@models")
const { Op } = require("sequelize")

module.exports = {
  async create(data, model, transaction = null) {
    return await db[model].create(data, { transaction })
  },

  async bulkCreate(dataArray, model, transaction = null) {
    return await db[model].bulkCreate(dataArray, { transaction })
  },

  async update(id, data, model, idField = "id", transaction = null) {
    return await db[model].update(data, {
      where: { [idField]: id },
      transaction,
    })
  },

  async findAll(query = {}, model, transaction = null) {
    return await db[model].findAll({
      where: query,
      transaction,
    })
  },

  async findOne(query = {}, model, transaction = null) {
    return await db[model].findOne({
      where: query,
      transaction,
    })
  },

  async findAndCountAll(
    query = {},
    model,
    page = 1,
    size = 10,
    sortField = "createdAt",
    sortOrder = "DESC",
    transaction = null
  ) {
    const offset = (page - 1) * size
    const limit = parseInt(size)

    const { count, rows } = await db[model].findAndCountAll({
      where: query,
      limit,
      offset,
      order: [[sortField, sortOrder]],
      transaction,
    })

    const totalPages = Math.ceil(count / limit)

    return { count, rows, totalPages }
  },

  async destroy(id, model, idField = "id", transaction = null) {
    return await db[model].destroy({
      where: { [idField]: id },
      transaction,
    })
  },

  async count(query = {}, model, transaction = null) {
    return await db[model].count({
      where: query,
      transaction,
    })
  },

  async sum(field, query = {}, model, transaction = null) {
    return await db[model].sum(field, {
      where: query,
      transaction,
    })
  },
}
