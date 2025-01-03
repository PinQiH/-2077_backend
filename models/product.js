"use strict"
const { Model } = require("sequelize")
const generateHooks = require("@utils/dateHook")

module.exports = (sequelize, DataTypes) => {
  class Product extends Model {
    static associate(models) {
      this.hasMany(models.OrderItem, { foreignKey: "product_id" })
      this.belongsTo(models.Brand, {
        foreignKey: "brand_id",
      })
    }
  }
  Product.init(
    {
      product_id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      name: DataTypes.STRING,
      description: DataTypes.TEXT,
      cost_price: DataTypes.DECIMAL,
      price: DataTypes.DECIMAL,
      stock: DataTypes.STRING,
      brand_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "brands",
          key: "brand_id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      product_url: { type: DataTypes.STRING, allowNull: false },
      image_urls: {
        type: DataTypes.JSON,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "Product",
      tableName: "products",
      hooks: generateHooks(["createdAt", "updatedAt"]),
    }
  )
  return Product
}
