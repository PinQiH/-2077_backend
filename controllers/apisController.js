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
          isRequired: true,
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
          isRequired: true,
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
      let {
        orderBy,
        orderDate = new Date(),
        status = "待處理",
        notes,
        items,
      } = req.body
      if (typeof items === "string") {
        items = JSON.parse(items)
      }

      validateInput([
        {
          labelName: "下單人",
          inputName: "orderBy",
          inputValue: orderBy,
          validateWay: "isNumber",
          isRequired: true,
        },
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
          return res.status(200).json({
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
        order_by: orderBy,
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
      const { page = 1, size = 10 } = req.query

      const { count, rows, totalPages } =
        await repository.generalRepo.findAndCountAll({}, "Order", page, size)

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "訂單列表",
        data: rows,
        pagination: {
          page: parseInt(page),
          perPage: parseInt(size),
          totalPages: totalPages,
          totalCount: count,
        },
      })
    } catch (err) {
      err.code = "GET_ORDERS_ERROR"
      next(err)
    }
  },
  // 查看訂單詳情"getOrderDetails"
  getOrderDetails: async (req, res, next) => {
    try {
      const orderId = req.params.orderId

      validateInput([
        {
          labelName: "訂單ID",
          inputName: "orderId",
          inputValue: orderId,
          validateWay: "isNumber",
          isRequired: true,
        },
      ])

      const order = await repository.orderRepo.getOrderDetails(orderId)
      if (!order) {
        return res.status(200).json({
          rtnCode: "0001",
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
  // 更新訂單"updateOrderStatus"
  updateOrder: async (req, res, next) => {
    const transaction = await db.sequelize.transaction()
    let transactionCommitted = false
    try {
      const orderId = req.params.orderId
      let { status, notes, items } = req.body
      if (typeof items === "string") {
        items = JSON.parse(items)
      }

      validateInput([
        {
          labelName: "訂單ID",
          inputName: "orderId",
          inputValue: orderId,
          validateWay: "isNumber",
          isRequired: true,
        },
        {
          labelName: "訂單狀態",
          inputName: "status",
          inputValue: status,
          validateWay: "isString",
          isRequired: false,
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

      // 查詢訂單是否存在
      const order = await repository.generalRepo.findOne(
        { order_id: orderId },
        "Order",
        transaction
      )
      if (!order) {
        await transaction.rollback()
        return res.status(200).json({
          rtnCode: "0001",
          rtnMsg: "訂單未找到",
        })
      }

      // 搜尋 items 中每個 product 的價格並計算總金額
      let total = 0
      let itemDatas = []
      if (items && items.length > 0) {
        // 刪除舊的訂單項目
        await repository.generalRepo.destroy(
          orderId,
          "OrderItem",
          "order_id",
          transaction
        )

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
            return res.status(200).json({
              rtnCode: "0002",
              rtnMsg: `商品不存在`,
            })
          }

          const itemTotal = product.price * quantity
          total += itemTotal

          const itemData = {
            order_id: orderId,
            product_id: productId,
            quantity: quantity,
            cost_price: product.cost_price,
            price: product.price,
            subtotal: product.price * quantity,
          }
          itemDatas.push(itemData)
        }
      }

      // 更新訂單資料
      const updatedData = { status, notes, total }
      await repository.generalRepo.update(
        orderId,
        updatedData,
        "Order",
        "order_id",
        transaction
      )
      await repository.generalRepo.bulkCreate(
        itemDatas,
        "OrderItem",
        transaction
      )

      await transaction.commit()
      transactionCommitted = true

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "訂單狀態更新成功",
      })
    } catch (err) {
      if (!transactionCommitted) {
        await transaction.rollback()
      }
      err.code = "UPDATE_ORDER_STATUS_ERROR"
      next(err)
    }
  },
  // 刪除訂單"deleteOrder"
  deleteOrder: async (req, res, next) => {
    try {
      const orderId = req.params.orderId

      validateInput([
        {
          labelName: "訂單ID",
          inputName: "orderId",
          inputValue: orderId,
          validateWay: "isNumber",
          isRequired: true,
        },
      ])

      await repository.generalRepo.destroy(orderId, "Order", "order_id")

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "訂單刪除成功",
      })
    } catch (err) {
      err.code = "DELETE_ORDER_ERROR"
      next(err)
    }
  },

  // -錢包管理
  // 新增支出/收入
  createTransaction: async (req, res, next) => {
    try {
      const { amount, type, description } = req.body

      validateInput([
        {
          labelName: "金額",
          inputName: "amount",
          inputValue: amount,
          validateWay: "isNumber",
          isRequired: true,
        },
        {
          labelName: "類型",
          inputName: "type",
          inputValue: type,
          validateWay: "isString",
          isRequired: true,
        },
        {
          labelName: "描述",
          inputName: "description",
          inputValue: description,
          validateWay: "isString",
          isRequired: false,
        },
      ])

      await repository.generalRepo.create(
        {
          amount,
          type,
          description,
        },
        "Transaction"
      )

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "新增交易成功",
      })
    } catch (err) {
      err.code = "CREATE_TRANSACTION_ERROR"
      next(err)
    }
  },
  // 刪除支出/收入
  deleteTransaction: async (req, res, next) => {
    try {
      const { transactionId } = req.params

      validateInput([
        {
          labelName: "交易ID",
          inputName: "transactionId",
          inputValue: transactionId,
          validateWay: "isNumber",
          isRequired: true,
        },
      ])

      const deletedCount = await repository.generalRepo.destroy(
        transactionId,
        "Transaction",
        "transaction_id"
      )

      if (!deletedCount) {
        return res.status(200).json({
          rtnCode: "0001",
          rtnMsg: "交易不存在",
        })
      }

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "刪除交易成功",
      })
    } catch (err) {
      err.code = "DELETE_TRANSACTION_ERROR"
      next(err)
    }
  },
  // 列出所有支出/收入
  getAllTransactions: async (req, res, next) => {
    try {
      const { page = 1, size = 10 } = req.query

      const { count, rows, totalPages } =
        await repository.generalRepo.findAndCountAll(
          {},
          "Transaction",
          page,
          size
        )

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "所有交易記錄",
        data: rows,
        pagination: {
          page: parseInt(page),
          perPage: parseInt(size),
          totalPages: totalPages,
          totalCount: count,
        },
      })
    } catch (err) {
      err.code = "GET_ALL_TRANSACTIONS_ERROR"
      next(err)
    }
  },
  // 結算利潤
  calculateProfit: async (req, res, next) => {
    try {
      const profit = await repository.transactionRepo.calculateProfit()

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "結算利潤成功",
        data: { profit },
      })
    } catch (err) {
      err.code = "CALCULATE_PROFIT_ERROR"
      next(err)
    }
  },

  // -優惠券管理
  // 新增優惠券
  createCoupon: async (req, res, next) => {
    try {
      const { code, discount, expiryDate } = req.body

      validateInput([
        {
          labelName: "代碼",
          inputName: "code",
          inputValue: code,
          validateWay: "isString",
          isRequired: true,
        },
        {
          labelName: "折扣",
          inputName: "discount",
          inputValue: discount,
          validateWay: "isNumber",
          isRequired: true,
        },
        {
          labelName: "到期日",
          inputName: "expiryDate",
          inputValue: expiryDate,
          validateWay: "isDate",
          isRequired: true,
        },
      ])

      const newCoupon = await db.Coupon.create({ code, discount, expiryDate })

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "新增優惠券成功",
        data: newCoupon,
      })
    } catch (err) {
      err.code = "CREATE_COUPON_ERROR"
      next(err)
    }
  },
  // 編輯優惠券
  updateCoupon: async (req, res, next) => {
    try {
      const { couponId } = req.params
      const { code, discount, expiryDate } = req.body

      const updatedCount = await db.Coupon.update(
        { code, discount, expiryDate },
        { where: { id: couponId } }
      )

      if (!updatedCount[0]) {
        return res.status(404).json({
          rtnCode: "4001",
          rtnMsg: "優惠券不存在",
        })
      }

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "更新優惠券成功",
      })
    } catch (err) {
      err.code = "UPDATE_COUPON_ERROR"
      next(err)
    }
  },
  // 刪除優惠券
  deleteCoupon: async (req, res, next) => {
    try {
      const { couponId } = req.params

      const deletedCount = await db.Coupon.destroy({ where: { id: couponId } })

      if (!deletedCount) {
        return res.status(404).json({
          rtnCode: "4001",
          rtnMsg: "優惠券不存在",
        })
      }

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "刪除優惠券成功",
      })
    } catch (err) {
      err.code = "DELETE_COUPON_ERROR"
      next(err)
    }
  },
  // 列出所有優惠券
  getAllCoupons: async (req, res, next) => {
    try {
      const coupons = await db.Coupon.findAll()

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "所有優惠券",
        data: coupons,
      })
    } catch (err) {
      err.code = "GET_ALL_COUPONS_ERROR"
      next(err)
    }
  },

  // -報表與統計
  // 總客數
  getCustomerReport: async (req, res, next) => {
    try {
      const totalCustomers = await repository.generalRepo.count(
        {},
        "Frontend_users"
      )

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "總客數",
        data: { totalCustomers },
      })
    } catch (err) {
      err.code = "GET_CUSTOMER_REPORT_ERROR"
      next(err)
    }
  },
  // 總營業額
  getRevenueReport: async (req, res, next) => {
    try {
      const totalRevenue = await repository.generalRepo.sum(
        "total",
        { status: "完成" },
        "Order"
      )

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "總營業額",
        data: { totalRevenue },
      })
    } catch (err) {
      err.code = "GET_REVENUE_REPORT_ERROR"
      next(err)
    }
  },
  // 連線門檻
  getThresholdReport: async (req, res, next) => {
    try {
      const threshold = await repository.generalRepo.sum(
        "total",
        { status: "待處理" },
        "Order"
      )

      return res.status(200).json({
        rtnCode: "0000",
        rtnMsg: "連線門檻報表",
        data: {
          threshold,
        },
      })
    } catch (err) {
      err.code = "GET_THRESHOLD_REPORT_ERROR"
      next(err)
    }
  },
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
