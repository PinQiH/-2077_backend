require("dotenv").config()

module.exports = {
  development: {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    host: process.env.DB_HOST,
    dialect: "postgres",
    logging: false,
    pool: {
      max: 1000, // 最大同時連線數量
      min: 0, // 最少保留連線數量
      idle: 10000, // 連線閒置時間（毫秒）
    },
    // migrationStorage: "sequelize",
    // migrationStorageTableName: "SequelizeMetaBackEnd", // 為開發環境指定一個唯一的表名
  },
  production: {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    host: process.env.DB_HOST,
    dialect: "postgres",
    logging: false,
    pool: {
      max: 1000, // 最大同時連線數量
      min: 0, // 最少保留連線數量
      idle: 10000, // 連線閒置時間（毫秒）
    },
    // migrationStorage: "sequelize",
    // migrationStorageTableName: "SequelizeMetaBackEnd", // 為開發環境指定一個唯一的表名
  },
}
