require("dotenv").config()
const db = require("@models")
const repository = require("@repository")
const ExcelJS = require("exceljs")
const fs = require("fs-extra")
const archiver = require("archiver")
const path = require("path")
const bcrypt = require("bcrypt")
const xlsx = require("xlsx")
const moment = require("moment")
const jwt = require("jsonwebtoken")
const fastCSV = require("fast-csv")
const crypto = require("crypto")
const {
  ValidationError,
  DatabaseConflictError,
  PermissionError,
  ThirdPartyApiError,
} = require("@utils/error")
const { cfCheck } = require("@utils/cloudFlareTurnstile")
const { sendMail } = require("@utils/emailSender")
const {
  fetchLocalApiData,
  sendLocalApiData,
  deleteLocalApiData,
  modifiedLocalApiData,
} = require("@utils/localApiService")
const { validateInput } = require("@utils/validators")
const { utilHelper } = require("@utils/utilHelper")
const isDev = process.env.NODE_ENV === "development"

module.exports = {
  test: async (req, res, next) => {
    try {
      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "連線成功",
      })
    } catch (err) {
      err.code = "TEST_ERROR"
      next(err)
    }
  },

  // >後台
  // -商品管理
  // 新增商品"createProduct"
  createProduct: async (req, res, next) => {
    try {
      let {
        name,
        costPrice,
        price,
        description,
        stock,
        imageUrls,
        productUrl,
        brand,
      } = req.body
      if (typeof imageUrls === "string") {
        imageUrls = JSON.parse(imageUrls)
      }

      validateInput([
        {
          labelName: "商品名稱",
          inputName: "name",
          inputValue: name,
          validateWay: "isString",
          isRequired: true,
        },
        {
          labelName: "成本價",
          inputName: "costPrice",
          inputValue: costPrice,
          validateWay: "isNumber",
          isRequired: true,
        },
        {
          labelName: "售價",
          inputName: "price",
          inputValue: price,
          validateWay: "isNumber",
          isRequired: true,
        },
        {
          labelName: "庫存",
          inputName: "stock",
          inputValue: stock,
          validateWay: "isString",
          isRequired: true,
        },
        {
          labelName: "商品介紹",
          inputName: "description",
          inputValue: description,
          validateWay: "isString",
          isRequired: false,
        },
        {
          labelName: "圖片",
          inputName: "imageUrls",
          inputValue: imageUrls,
          validateWay: "isArray",
          isRequired: true,
        },
        {
          labelName: "商品連結",
          inputName: "productUrl",
          inputValue: productUrl,
          validateWay: "isString",
          isRequired: true,
        },
        {
          labelName: "品牌",
          inputName: "brand",
          inputValue: brand,
          validateWay: "isString",
          isRequired: true,
        },
      ])

      const existingBrand = await repository.generalRepo.findOne(
        { name: brand },
        "Brand"
      )
      let brandId
      if (existingBrand) {
        brandId = existingBrand.brand_id
      } else {
        // 若資料不存在，執行創建操作
        const brandData = {
          name: brand,
        }
        const createBrand = await repository.generalRepo.create(
          brandData,
          "Brand"
        )
        brandId = createBrand.brand_id
      }

      const existingProduct = await repository.generalRepo.findOne(
        { name: name },
        "Product"
      )
      if (existingProduct) {
        return res.status(200).json({
          rtnCode: "0001",
          rtnMsg: "商品已存在",
        })
      } else {
        // 若資料不存在，執行創建操作
        const data = {
          name: name,
          description: description,
          image_urls: imageUrls,
          product_url: productUrl,
          cost_price: costPrice,
          price: price,
          stock: stock,
          brand_id: brandId,
        }
        await repository.generalRepo.create(data, "Product")
      }

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "商品新增成功",
      })
    } catch (err) {
      err.code = "CREATE_PRODUCT_ERROR"
      next(err)
    }
  },
  // 更新商品資訊"updateProduct"
  updateProduct: async (req, res, next) => {
    try {
      const productId = req.params.productId
      const {
        name,
        description,
        costPrice,
        price,
        stock,
        imageUrls,
        productUrl,
        brand,
      } = req.body

      validateInput([
        {
          labelName: "商品ID",
          inputName: "productId",
          inputValue: productId,
          validateWay: "isNumber",
          isRequired: false,
        },
        {
          labelName: "商品名稱",
          inputName: "name",
          inputValue: name,
          validateWay: "isString",
          isRequired: false,
        },
        {
          labelName: "成本價",
          inputName: "costPrice",
          inputValue: costPrice,
          validateWay: "isNumber",
          isRequired: false,
        },
        {
          labelName: "售價",
          inputName: "price",
          inputValue: price,
          validateWay: "isNumber",
          isRequired: false,
        },
        {
          labelName: "庫存",
          inputName: "stock",
          inputValue: stock,
          validateWay: "isString",
          isRequired: false,
        },
        {
          labelName: "商品介紹",
          inputName: "description",
          inputValue: description,
          validateWay: "isString",
          isRequired: false,
        },
        {
          labelName: "圖片",
          inputName: "imageUrls",
          inputValue: imageUrls,
          validateWay: "isArray",
          isRequired: false,
        },
        {
          labelName: "商品連結",
          inputName: "productUrl",
          inputValue: productUrl,
          validateWay: "isString",
          isRequired: false,
        },
        {
          labelName: "品牌",
          inputName: "brand",
          inputValue: brand,
          validateWay: "isString",
          isRequired: false,
        },
      ])

      const existingBrand = await repository.generalRepo.findOne(
        { name: brand },
        "Brand"
      )
      let brandId
      if (existingBrand) {
        brandId = existingBrand.brand_id
      } else {
        // 若資料不存在，執行創建操作
        const brandData = {
          name: brand,
        }
        const createBrand = await repository.generalRepo.create(
          brandData,
          "Brand"
        )
        brandId = createBrand.brand_id
      }

      const existingProduct = await repository.generalRepo.findOne(
        { product_id: productId },
        "Product"
      )
      if (existingProduct) {
        // 若資料已存在，執行更新操作
        await repository.generalRepo.update(
          productId, // 查找條件
          {
            name: name,
            cost_price: costPrice, // 更新售價
            price: price, // 更新價格
            stock: stock, // 更新庫存
            image_urls: imageUrls,
            product_url: productUrl,
            brand_id: brandId,
          },
          "Product",
          "product_id"
        )
      } else {
        return res.status(200).json({
          rtnCode: "0001",
          rtnMsg: "商品未找到",
        })
      }

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "商品更新成功",
      })
    } catch (err) {
      err.code = "UPDATE_PRODUCT_ERROR"
      next(err)
    }
  },
  // 刪除商品"deleteProduct"
  deleteProduct: async (req, res, next) => {
    try {
      const productId = req.params.productId

      validateInput([
        {
          labelName: "商品ID",
          inputName: "productId",
          inputValue: productId,
          validateWay: "isNumber",
          isRequired: false,
        },
      ])

      const existingProduct = await repository.generalRepo.findOne(
        { product_id: productId },
        "Product"
      )
      if (existingProduct) {
        // 若資料已存在，執行更新操作
        await repository.generalRepo.destroy(
          productId, // 查找條件
          "Product",
          "product_id"
        )
      } else {
        return res.status(200).json({
          rtnCode: "0001",
          rtnMsg: "商品未找到",
        })
      }

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "商品刪除成功",
      })
    } catch (err) {
      err.code = "DELETE_PRODUCT_ERROR"
      next(err)
    }
  },
  // 列出所有商品"getProducts"
  getProducts: async (req, res, next) => {
    try {
      const { page = 1, size = 10 } = req.query

      const { count, rows, totalPages } =
        await repository.generalRepo.findAndCountAll({}, "Product", page, size)

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "商品列表",
        data: rows,
        pagination: {
          page: parseInt(page),
          perPage: parseInt(size),
          totalPages: totalPages,
          totalCount: count,
        },
      })
    } catch (err) {
      err.code = "GET_PRODUCTS_ERROR"
      next(err)
    }
  },

  // -訂單管理
  // 新增訂單"createOrders"
  createOrders: async (req, res, next) => {
    const transaction = await db.sequelize.transaction()
    let transactionCommitted = false
    try {
      let { orderDate = new Date(), status = "待處理", notes, items } = req.body
      if (typeof items === "string") {
        items = JSON.parse(items)
      }

      validateInput([
        {
          labelName: "訂單日期",
          inputName: "orderDate",
          inputValue: orderDate,
          validateWay: "isDate",
          isRequired: true,
        },
        {
          labelName: "訂單狀態",
          inputName: "status",
          inputValue: status,
          validateWay: "isString",
          isRequired: true,
        },
        {
          labelName: "備註",
          inputName: "notes",
          inputValue: notes,
          validateWay: "isString",
          isRequired: false,
        },
        {
          labelName: "訂單內容",
          inputName: "items",
          inputValue: items,
          validateWay: "isArray",
          isRequired: true,
        },
      ])

      if (!items || !Array.isArray(items) || items.length === 0) {
        if (!transactionCommitted) {
          await transaction.rollback()
        }
        return res.status(200).json({
          rtnCode: "0001",
          rtnMsg: "訂單需包含至少一個商品項目",
        })
      }

      // 搜尋 items 中每個 product 的價格並計算總金額
      let total = 0
      let itemDatas = []
      for (const item of items) {
        const { productId, quantity } = item

        // 查詢商品價格
        const product = await repository.generalRepo.findOne(
          { product_id: productId },
          "Product",
          transaction
        )
        if (!product) {
          if (!transactionCommitted) {
            await transaction.rollback()
          }
          return res.status(404).json({
            rtnCode: "0002",
            rtnMsg: `商品不存在`,
          })
        }

        const itemTotal = product.price * quantity
        total += itemTotal

        const itemData = {
          // order_id: newOrder.order_id,
          product_id: productId,
          quantity,
          cost_price: product.cost_price,
          price: product.price,
          subtotal: product.price * quantity,
        }
        itemDatas.push(itemData)
      }

      // 創建訂單資料
      const data = {
        order_date: orderDate,
        total: total,
        status: status,
        notes: notes,
      }
      const newOrder = await repository.generalRepo.create(
        data,
        "Order",
        transaction
      )

      // 創建訂單項目資料
      const orderItems = itemDatas.map((item) => ({
        order_id: newOrder.order_id,
        product_id: item.product_id,
        quantity: item.quantity,
        cost_price: item.cost_price,
        price: item.price,
        subtotal: item.subtotal,
      }))
      await repository.generalRepo.bulkCreate(
        orderItems,
        "OrderItem",
        transaction
      )

      await transaction.commit()
      transactionCommitted = true

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "訂單新增成功",
      })
    } catch (err) {
      if (!transactionCommitted) {
        await transaction.rollback()
      }
      err.code = "CREATE_ORDERS_ERROR"
      next(err)
    }
  },
  // 列出所有訂單"getOrders"
  getOrders: async (req, res, next) => {
    try {
      const { page = 1, limit = 10, status } = req.query
      const whereClause = status ? { status } : {}

      const orders = await db.Order.findAll({
        where: whereClause,
        offset: (page - 1) * limit,
        limit: parseInt(limit),
      })

      const totalOrders = await db.Order.count({ where: whereClause })

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "訂單列表",
        data: orders,
        total: totalOrders,
      })
    } catch (err) {
      err.code = "GET_ORDERS_ERROR"
      next(err)
    }
  },
  // 查看訂單詳情"getOrderDetails"
  getOrderDetails: async (req, res, next) => {
    try {
      const orderId = req.params.id
      const order = await db.Order.findOne({ where: { id: orderId } })

      if (!order) {
        return res.status(404).json({
          rtnCode: "4001",
          rtnMsg: "訂單未找到",
        })
      }

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "訂單詳情",
        data: order,
      })
    } catch (err) {
      err.code = "GET_ORDER_DETAILS_ERROR"
      next(err)
    }
  },
  // 更新訂單狀態"updateOrderStatus"
  updateOrderStatus: async (req, res, next) => {
    try {
      const orderId = req.params.id
      const { status } = req.body

      const updatedOrder = await db.Order.update(
        { status },
        { where: { id: orderId } }
      )

      if (!updatedOrder) {
        return res.status(404).json({
          rtnCode: "4001",
          rtnMsg: "訂單未找到",
        })
      }

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "訂單狀態更新成功",
      })
    } catch (err) {
      err.code = "UPDATE_ORDER_STATUS_ERROR"
      next(err)
    }
  },
  // 刪除訂單"deleteOrder"
  deleteOrder: async (req, res, next) => {
    try {
      const orderId = req.params.id
      const deletedOrder = await db.Order.destroy({ where: { id: orderId } })

      if (!deletedOrder) {
        return res.status(404).json({
          rtnCode: "4001",
          rtnMsg: "訂單未找到",
        })
      }

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "訂單刪除成功",
      })
    } catch (err) {
      err.code = "DELETE_ORDER_ERROR"
      next(err)
    }
  },

  // -支付管理
  // 創建支付請求"createPayment"
  createPayment: async (req, res, next) => {
    try {
      const { orderId, amount, paymentMethod } = req.body
      // 假設支付請求創建邏輯
      const payment = await db.Payment.create({
        orderId,
        amount,
        paymentMethod,
      })

      return res.status(201).json({
        rtnCode: "0000",
        rtnMsg: "支付請求創建成功",
        data: payment,
      })
    } catch (err) {
      err.code = "CREATE_PAYMENT_ERROR"
      next(err)
    }
  },
  // 查詢支付狀態"getPaymentStatus"
  getPaymentStatus: async (req, res, next) => {
    try {
      const paymentId = req.params.id
      const payment = await db.Payment.findOne({ where: { id: paymentId } })

      if (!payment) {
        return res.status(404).json({
          rtnCode: "4001",
          rtnMsg: "支付未找到",
        })
      }

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "支付狀態",
        data: payment,
      })
    } catch (err) {
      err.code = "GET_PAYMENT_STATUS_ERROR"
      next(err)
    }
  },

  // -報表與統計
  // 訂單報表"getOrderReport"
  getOrderReport: async (req, res, next) => {
    try {
      const { startDate, endDate } = req.query
      // 假設報表邏輯
      const orderReport = await db.Order.findAll({
        where: { createdAt: { [Op.between]: [startDate, endDate] } },
      })

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "訂單報表",
        data: orderReport,
      })
    } catch (err) {
      err.code = "GET_ORDER_REPORT_ERROR"
      next(err)
    }
  },
  // 商品銷售報表"getProductReport"
  getProductReport: async (req, res, next) => {
    try {
      const { startDate, endDate } = req.query
      // 假設銷售報表邏輯
      const productReport = await db.OrderItem.findAll({
        where: { createdAt: { [Op.between]: [startDate, endDate] } },
      })

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "商品銷售報表",
        data: productReport,
      })
    } catch (err) {
      err.code = "GET_PRODUCT_REPORT_ERROR"
      next(err)
    }
  },
  // 用戶活躍報表"getUserReport"
  getUserReport: async (req, res, next) => {
    try {
      const { startDate, endDate } = req.query
      // 假設用戶報表邏輯
      const userReport = await db.User.findAll({
        where: { createdAt: { [Op.between]: [startDate, endDate] } },
      })

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "用戶活躍報表",
        data: userReport,
      })
    } catch (err) {
      err.code = "GET_USER_REPORT_ERROR"
      next(err)
    }
  },

  // -系統狀態檢查
  // 系統狀態檢查"checkSystemStatus"
  checkSystemStatus: async (req, res, next) => {
    try {
      // 假設系統狀態檢查邏輯
      const systemStatus = {
        database: "正常",
        services: "正常",
        lastChecked: new Date(),
      }

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "系統狀態檢查成功",
        data: systemStatus,
      })
    } catch (err) {
      err.code = "SYSTEM_STATUS_CHECK_ERROR"
      next(err)
    }
  },
}
