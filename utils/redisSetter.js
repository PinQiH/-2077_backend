const Redis = require("ioredis")
const JSONbig = require("json-bigint")
const { ThirdPartyApiError } = require("./error")

let redisClient
const localCache = new Map()

function createRedisClient(options) {
  try {
    const redisOptions = {
      host: options.redisHost || "localhost",
      port: options.redisPort || 6379,
      password: options.redisPassword || "",
      retryStrategy: () => null, // 禁用重新嘗試連線
    }
    return new Redis(redisOptions)
  } catch (error) {
    throw new Error("Failed to create Redis client")
  }
}

function initializeRedisClient(options) {
  if (options.redisOn) {
    if (
      !redisClient ||
      redisClient.status === "end" ||
      redisClient.status === "error"
    ) {
      try {
        redisClient = createRedisClient(options)
        redisClient.on("connect", function () {
          console.log(`Client connected`)
        })
        redisClient.on("error", function (err) {
          console.log("Error " + err)
          redisClient = null // 清除無效的 Redis 客戶端
        })
        redisClient.on("end", function () {
          console.log(`Client disconnected`)
        })
      } catch (err) {
        redisClient = null
        throw new Error("Failed to initialize Redis client", err)
      }
    }
  } else {
    console.log("Redis is disabled, using local cache")
    redisClient = null
  }
}

async function safelyExecuteRedisCommand(command) {
  if (!redisClient) {
    console.warn("Redis client is not initialized, using local cache")
    return null
  }
  try {
    return await command()
  } catch (err) {
    throw new Error("Redis command execution failed", {
      data: err,
    })
  }
}

module.exports = {
  setRedisKey: async (cacheKey, cacheData, expired, options = {}) => {
    let dataToStore = ""
    try {
      initializeRedisClient(options)
      // 驗證並序列化資料
      if (typeof cacheData === "object" && cacheData !== null) {
        dataToStore = JSONbig.stringify(cacheData) // 物件需要進行序列化
      } else {
        dataToStore = cacheData
      }

      if (dataToStore === null || dataToStore === undefined) {
        throw new Error("Redis set data cannot be null or undefined")
      }

      // 嘗試設定 Redis 鍵值
      const result = await safelyExecuteRedisCommand(() =>
        expired !== undefined
          ? redisClient.set(cacheKey, dataToStore, "EX", expired)
          : redisClient.set(cacheKey, dataToStore)
      )

      if (result === "OK") {
        console.log("------redis set success------")
      } else {
        throw new Error("Failed to set Redis key")
      }
    } catch (error) {
      !!options.isDev
        ? console.warn(
            `Failed to set ${cacheKey} to Redis, using local cache`,
            error
          )
        : console.warn(`Failed to set key to Redis, using local cache.`, error)
      try {
        localCache.set(cacheKey, {
          data: dataToStore,
          expired: expired !== undefined ? Date.now() + expired * 1000 : null,
        })
        console.log(`------local cache set success------`)
      } catch (localCacheError) {
        throw new ThirdPartyApiError(`Failed to set local cache key`, {
          data: {
            originalError: error,
            localCacheError: localCacheError,
          },
        })
      }
    }
  },
  getRedisKey: async (cacheKey, options = {}) => {
    try {
      initializeRedisClient(options)
      const value = await safelyExecuteRedisCommand(() =>
        redisClient.get(cacheKey)
      )

      // 轉換資料格式
      if (value) {
        if (
          typeof value === "string" &&
          (value.startsWith("{") || value.startsWith("["))
        ) {
          try {
            return JSONbig.parse(value)
          } catch (error) {
            console.warn("JSON parse error: ", error)
            return value
          }
        }
        return value
      }

      return null
    } catch (error) {
      !!options.isDev
        ? console.warn(
            `Fail to get ${cacheKey} from Redis, using local cache.`,
            error
          )
        : console.warn(`Fail to get Redis data, using local cache.`, error)

      try {
        const localData = localCache.get(cacheKey)
        if (localData) {
          if (localData.expired && localData.expired < Date.now()) {
            localCache.delete(cacheKey) // 如果過期，刪除本地端快取
            return null
          }
          console.log(`------local cache get success------`)
          return localData.data
        }
        return null
      } catch (localCacheError) {
        throw new ThirdPartyApiError(`Failed to get local cache key.`, {
          data: {
            originalError: error,
            localCacheError: localCacheError,
          },
        })
      }
    }
  },
  deleteRedisKey: async (cacheKey, options = {}) => {
    try {
      initializeRedisClient(options)
      const result = await safelyExecuteRedisCommand(() =>
        redisClient.del(cacheKey)
      )
      if (result) {
        console.log(`------ redis delete success ------`)
      }
    } catch (error) {
      !!options.isDev
        ? console.warn(
            `Fail to delete key ${cacheKey} from Redis, using local cache.`,
            error
          )
        : console.warn(`Fail to delete Redis Key, using local cache.`, error)

      try {
        localCache.delete(cacheKey)
        console.log(`------ local cache delete success ------`)
      } catch (localCacheError) {
        throw new ThirdPartyApiError(`Failed to delete local cache key.`, {
          data: {
            originalError: error,
            localCacheError: localCacheError,
          },
        })
      }
    }
  },
}
