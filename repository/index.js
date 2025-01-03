"use strict"

const fs = require("fs")
const path = require("path")
const basename = path.basename(__filename)

const repositories = {}

// 讀取目錄下的所有文件（除了index.js本身），並將它們作為模塊導入
fs.readdirSync(__dirname)
  .filter((file) => {
    return (
      file.indexOf(".") !== 0 && file !== basename && file.slice(-3) === ".js"
    )
  })
  .forEach((file) => {
    const repository = require(path.join(__dirname, file))
    const repositoryName = file.slice(0, -3) // 去掉文件名的.js后缀来获取Repository名
    repositories[repositoryName] = repository
  })

module.exports = repositories
