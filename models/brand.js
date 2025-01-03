"use strict"
const { Model } = require("sequelize")
const generateHooks = require("@utils/dateHook")

module.exports = (sequelize, DataTypes) => {
  class Brand extends Model {
    static associate(models) {
      this.hasMany(models.Product, { foreignKey: "brand_id" })
    }
  }
  Brand.init(
    {
      brand_id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      name: DataTypes.STRING,
      description: DataTypes.TEXT,
    },
    {
      sequelize,
      modelName: "Brand",
      tableName: "brands",
      hooks: generateHooks(["createdAt", "updatedAt"]),
    }
  )
  return Brand
}
