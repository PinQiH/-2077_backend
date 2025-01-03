const cron = require("node-cron")
const db = require("@models")
const { Op } = require("sequelize")
const axios = require("axios")
const cheerio = require("cheerio")
const repository = require("@repository")

let cronExpression =
  process.env.NODE_ENV === "development" ? "0 0 * * *" : "0 0 * * *"

// 讀取產品資訊
async function updateProductInfo() {
  try {
    // 創建一個 axios 實例來保持會話
    const session = axios.create({
      withCredentials: true, // 設置 cookies 支持
    })

    // 在請求發送前檢查 request headers
    session.interceptors.request.use(
      (config) => {
        // 強制設置 cookie 標頭
        config.headers["Cookie"] =
          "_ga=GA1.1.9132822.1735807847; msn103527=6832795; msn_chk103527=4048914; ASP.NET_SessionId=i30xiswrtusgt52ra3q54fjx; Osn103527=; _gcl_au=1.1.1337251428.1735807847.1361741610.1735869296.1735870022; _ga_FTT5Z607T5=GS1.1.1735883164.3.1.1735883165.0.0.0"
        // console.log("Request Headers:", config.headers) // 在這裡檢查請求的 headers
        return config // 繼續請求
      },
      (error) => {
        return Promise.reject(error) // 處理請求錯誤
      }
    )

    const url =
      "https://www.shop2000.com.tw/%E9%9F%93%E5%A6%9D%E6%89%B9%E7%99%BC/home"
    const response = await session.get(url)
    const $ = cheerio.load(response.data)

    // Loop through each product item
    $("#plist_tb1744932 .p_td").each(async (index, element) => {
      const productName = $(element).find(".p_ul li").text().trim()
      const productStock = $(element)
        .find(".stk.inblock.showOp")
        .find("stkt0")
        .text()
        .trim()
      const productImage = $(element).find(".pimg").attr("src")
      const productUrl = $(element).find("a").attr("href")
      const generalPrice = $(element)
        .find(".prik")
        .first()
        .find(".price1")
        .text()
      const memberPrice = $(element).find(".prik").last().find(".price1").text()

      // 去除非數字字符
      const numericGeneralPrice = parseFloat(
        generalPrice.replace(/[^0-9.-]+/g, "")
      ) // 只保留數字和小數點
      const numericMemberPrice = parseFloat(
        memberPrice.replace(/[^0-9.-]+/g, "")
      ) // 只保留數字和小數點

      // Log or save to database (adjust this part for your needs)
      // console.log(`Product Name: ${productName}`)
      // console.log(`Stock: ${productStock}`)
      // console.log(`Image URL: ${productImage}`)
      // console.log(`Product URL: ${productUrl}`)
      // console.log(`General Price: ${numericGeneralPrice}`)
      // console.log(`Member Price: ${numericMemberPrice}`)
      // console.log(`=====================================`)

      // 計算售價
      const costPriceWithMarkup = Math.ceil(
        parseFloat(numericMemberPrice) * 1.5
      )
      const finalPrice = Math.min(
        costPriceWithMarkup,
        parseFloat(numericGeneralPrice)
      )

      const existingProduct = await repository.generalRepo.findOne(
        { name: productName },
        "Product"
      )
      if (existingProduct) {
        // 若資料已存在，執行更新操作
        await repository.generalRepo.update(
          productName, // 查找條件
          {
            cost_price: numericMemberPrice, // 更新售價
            price: finalPrice, // 更新價格
            stock: productStock, // 更新庫存
            image_urls: [productImage],
            product_url: productUrl,
          },
          "Product",
          "name"
        )
      } else {
        // 若資料不存在，執行創建操作
        const data = {
          name: productName,
          image_urls: [productImage],
          product_url: productUrl,
          cost_price: numericMemberPrice,
          price: finalPrice,
          stock: productStock,
        }
        await repository.generalRepo.create(data, "Product")
      }
    })
  } catch (err) {
    console.error("Error scraping the website:", err)
  }
}

const productTasks = cron.schedule(
  cronExpression,
  async () => {
    console.time("每日更新 productTasks 任務")
    try {
      await updateProductInfo()
    } catch (err) {
      console.error(err)
    }
    console.timeEnd("每日更新 productTasks 任務")
  },
  {
    scheduled: false,
  }
)

module.exports = {
  productTasks: {
    start: () => productTasks.start(),
    stop: () => productTasks.stop(),
  },
}
