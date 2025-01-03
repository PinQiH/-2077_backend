const { Model, DataTypes } = require("sequelize")
const generateHooks = require("@utils/dateHook")

module.exports = (sequelize) => {
  class IP_log extends Model {
    static associate(models) {
      // 定義任何關聯
    }
  }

  IP_log.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      ip: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      use_type: {
        type: DataTypes.TEXT,
      },
    },
    {
      sequelize,
      modelName: "IP_log",
      tableName: "IP_log",
      hooks: generateHooks(["createdAt", "updatedAt"]),
    }
  )

  return IP_log
}
