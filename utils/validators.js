const Joi = require("joi")
const { ValidationError } = require("./error")
const idNumberValidation = (value) => {
  try {
    const charMap = {
      A: 10,
      B: 11,
      C: 12,
      D: 13,
      E: 14,
      F: 15,
      G: 16,
      H: 17,
      I: 34,
      J: 18,
      K: 19,
      L: 20,
      M: 21,
      N: 22,
      O: 35,
      P: 23,
      Q: 24,
      R: 25,
      S: 26,
      T: 27,
      U: 28,
      V: 29,
      W: 32,
      X: 30,
      Y: 31,
      Z: 33,
    }
    let sum = 0
    const convertedPrefix = charMap[value.charAt(0)].toString()
    sum += parseInt(convertedPrefix.charAt(0)) * 1
    sum += parseInt(convertedPrefix.charAt(1)) * 9

    for (let i = 1; i < 9; i++) {
      sum += parseInt(value.charAt(i)) * (9 - i)
    }
    sum += parseInt(value.charAt(9)) * 1

    if (sum % 10 !== 0) {
      throw `身分證格式錯誤`
    }
    return value
  } catch (err) {
    throw err
  }
}

const validPostalCodePrefixes = [
  "100",
  "103",
  "104",
  "105",
  "106",
  "108",
  "110",
  "111",
  "112",
  "114",
  "115",
  "116",
  "200",
  "201",
  "202",
  "203",
  "204",
  "205",
  "206",
  "207",
  "208",
  "220",
  "221",
  "222",
  "223",
  "224",
  "226",
  "227",
  "228",
  "231",
  "232",
  "233",
  "234",
  "235",
  "236",
  "237",
  "238",
  "239",
  "241",
  "242",
  "243",
  "244",
  "247",
  "248",
  "249",
  "251",
  "252",
  "253",
  "260",
  "261",
  "262",
  "263",
  "264",
  "265",
  "266",
  "267",
  "268",
  "269",
  "270",
  "272",
  "290",
  "300",
  "302",
  "303",
  "304",
  "305",
  "306",
  "307",
  "308",
  "310",
  "311",
  "312",
  "313",
  "314",
  "315",
  "320",
  "324",
  "325",
  "326",
  "327",
  "328",
  "330",
  "333",
  "334",
  "335",
  "336",
  "337",
  "338",
  "350",
  "351",
  "352",
  "353",
  "354",
  "356",
  "357",
  "358",
  "360",
  "361",
  "362",
  "363",
  "364",
  "365",
  "366",
  "367",
  "368",
  "369",
  "400",
  "401",
  "402",
  "403",
  "404",
  "406",
  "407",
  "408",
  "411",
  "412",
  "413",
  "414",
  "420",
  "421",
  "422",
  "423",
  "424",
  "426",
  "427",
  "428",
  "429",
  "432",
  "433",
  "434",
  "435",
  "436",
  "437",
  "438",
  "439",
  "500",
  "502",
  "503",
  "504",
  "505",
  "506",
  "507",
  "508",
  "509",
  "510",
  "511",
  "512",
  "513",
  "514",
  "515",
  "516",
  "520",
  "521",
  "522",
  "523",
  "524",
  "525",
  "526",
  "527",
  "528",
  "530",
  "540",
  "541",
  "542",
  "544",
  "545",
  "546",
  "551",
  "552",
  "553",
  "555",
  "556",
  "557",
  "558",
  "600",
  "602",
  "603",
  "604",
  "605",
  "606",
  "607",
  "608",
  "611",
  "612",
  "613",
  "614",
  "615",
  "616",
  "621",
  "622",
  "623",
  "624",
  "625",
  "630",
  "631",
  "632",
  "633",
  "634",
  "635",
  "636",
  "637",
  "638",
  "640",
  "643",
  "646",
  "647",
  "648",
  "649",
  "651",
  "652",
  "653",
  "654",
  "655",
  "700",
  "701",
  "702",
  "704",
  "708",
  "709",
  "710",
  "711",
  "712",
  "713",
  "714",
  "715",
  "716",
  "717",
  "718",
  "719",
  "720",
  "721",
  "722",
  "723",
  "724",
  "725",
  "726",
  "730",
  "731",
  "732",
  "733",
  "734",
  "735",
  "736",
  "737",
  "741",
  "742",
  "743",
  "744",
  "745",
  "800",
  "801",
  "802",
  "803",
  "804",
  "805",
  "806",
  "807",
  "811",
  "812",
  "813",
  "814",
  "815",
  "820",
  "821",
  "822",
  "823",
  "824",
  "825",
  "826",
  "827",
  "828",
  "829",
  "830",
  "831",
  "832",
  "833",
  "840",
  "842",
  "843",
  "844",
  "845",
  "846",
  "847",
  "848",
  "849",
  "851",
  "852",
  "817",
  "819",
  "880",
  "881",
  "882",
  "883",
  "884",
  "885",
  "900",
  "901",
  "902",
  "903",
  "904",
  "905",
  "906",
  "907",
  "908",
  "909",
  "911",
  "912",
  "913",
  "920",
  "921",
  "922",
  "923",
  "924",
  "925",
  "926",
  "927",
  "928",
  "929",
  "931",
  "932",
  "940",
  "941",
  "942",
  "943",
  "944",
  "945",
  "946",
  "947",
  "950",
  "951",
  "952",
  "953",
  "954",
  "955",
  "956",
  "957",
  "958",
  "959",
  "961",
  "962",
  "963",
  "964",
  "965",
  "966",
  "970",
  "971",
  "972",
  "973",
  "974",
  "975",
  "976",
  "977",
  "978",
  "979",
  "981",
  "982",
  "983",
  "890",
  "891",
  "892",
  "893",
  "894",
  "896",
  "209",
  "210",
  "211",
  "212",
]

const validPostalCodesSet = new Set(validPostalCodePrefixes)

const postalCodePrefixValidation = (value, helpers) => {
  const prefix = value.substring(0, 3) // 提取前3碼
  if (!validPostalCodesSet.has(prefix)) {
    return helpers.message(`{#label} 的前3碼不是有效的台灣郵遞區號`)
  }
  return value
}

const baseErrorMessages = {
  "string.base": "{#label} 必須是一個字串",
  "string.email": "請輸入有效的電子郵件地址",
  "string.empty": "{#label} 不得為空",
  "any.required": "{#label} 此欄位是必填的",
  "date.format":
    "{#label} 必須是有效的timestamp格式，ex:[2023-10-08T16:00:13.315Z]",
  "date.less": "{#label} 必須在當前日期之前",
  "boolean.base": "{#label} 必須為布林值",
  "object.base": "{#label} 必須為物件",
  "number.base": "{#label} 必須為數字",
  "string.guid": "{#label} 必須為UUID格式",
  "array.base": "{#label} 必須是一個陣列",
  "date.base":
    "{#label} 日期格式必須如是'YYYY-MM-DD'或'YYYY-MM-DDTHH:mm:ss.sssZ'",
  "date.min": "{#label} 必須大於或等於 {#limit}",
  "date.max": "{#label} 必須小於或等於 {#limit}",
}

const rules = {
  isUrl: Joi.string()
    .label("URL")
    .uri({
      scheme: ["http", "https"],
    })
    .messages({
      ...baseErrorMessages,
      "string.uri": "{#label} 必須是一個有效的 URL",
    }),
  isPostalCode: Joi.string()
    .label("郵遞區號")
    .trim()
    .pattern(/^[0-9]{3}([0-9]{2,3})?$/)
    .custom(postalCodePrefixValidation) // 使用自定義函數進行前3碼的驗證
    .messages({
      ...baseErrorMessages,
      "string.pattern.base": "{#label} 格式錯誤，必須為3碼、5碼或6碼的數字",
    }),
  isDate: Joi.date()
    .label("日期")
    .iso()
    .messages({
      ...baseErrorMessages,
      "date.min": `{#label} 必須大於或等於 {#limit}`,
      "date.max": `{#label} 必須小於或等於 {#limit}`,
    }),
  email: Joi.string()
    .label("信箱")
    .email()
    .min(8)
    .max(255)
    .trim()
    .lowercase()
    .messages({
      ...baseErrorMessages,
      "string.min": "{#label}長度需再8~255字元之間",
      "string.max": "{#label}長度需再8~255字元之間",
    }),
  password: Joi.string()
    .label("密碼")
    .min(10)
    .max(16)
    .pattern(/^[A-Za-z0-9!@#$%^&*]*$/) // 特殊符號允許範圍
    .pattern(/[A-Z]/) // 至少一個大寫字母
    .pattern(/[a-z]/) // 至少一個小寫字母
    .pattern(/\d/) // 至少一個數字
    .messages({
      ...baseErrorMessages,
      "string.pattern.base":
        "{#label} 格式錯誤，僅允許字母、數字及特定特殊字符 (!@#$%^&*)",
      "string.min": "{#label} 長度至少需要 {#limit} 個字元",
      "string.max": "{#label} 長度不能超過 {#limit} 個字元",
    }),
  isString: Joi.string().label("文字").trim().messages(baseErrorMessages),
  userName: Joi.string()
    .label("姓名")
    .trim()
    .pattern(/^[a-zA-Z\s\u4e00-\u9fa5]+$/)
    .min(2)
    .max(30)
    .messages({
      ...baseErrorMessages,
      "string.pattern.base": "{#label} 僅限中英文",
      "string.min": "{#label} 長度需在2字元以上",
      "string.max": "{#label} 長度需在30字元以內",
    }),
  birthday: Joi.date()
    .label("生日")
    .iso()
    .less("now")
    .messages(baseErrorMessages),
  idNumber: Joi.string()
    .label("身分證")
    .trim()
    .pattern(/^[a-zA-Z][1-2]\d{8}$/)
    .custom(idNumberValidation)
    .messages({
      ...baseErrorMessages,
      "string.pattern.base": "{#label} 格式錯誤",
    }),
  isBoolean: Joi.boolean().messages(baseErrorMessages),
  isObject: Joi.object().messages(baseErrorMessages),
  isAlphabet: Joi.string()
    .trim()
    .pattern(/^[a-zA-Z]+$/)
    .messages({
      ...baseErrorMessages,
      "string.pattern.base": "{#label}僅限英文",
    }),
  isAlphaNumeric: Joi.string()
    .label("英數字串")
    .trim()
    .pattern(/^[a-zA-Z0-9]+$/)
    .messages({
      ...baseErrorMessages,
      "string.pattern.base": "{#label} 只能包含英文字母和數字",
    }),
  isNumber: Joi.number()
    .integer()
    .messages({
      ...baseErrorMessages,
      "number.max": "{#label} 必須小於或等於{#limit}",
      "number.min": "{#label} 必須大於或等於{#limit}",
      "any.only": "{#label} 輸入錯誤",
    }),
  isUUID: Joi.string()
    .guid(/*{ version: ["uuidv4"]}*/)
    .messages(baseErrorMessages),
  isArray: Joi.array().messages({
    "array.base": "{#label} 必須是一個陣列",
    "array.min": "{#label} 至少要有一個元素",
    "any.required": "{#label} 是必需的",
  }),
}

const validateInput = (inputArray) => {
  try {
    const schemaObj = {}

    for (const item of inputArray) {
      const {
        labelName, //錯誤時顯示的標籤名稱
        inputName, //欄位名稱
        inputValue, //欄位值
        validateWay, //驗證方式
        isRequired = true, //是否必填
        minLength, //最小長度
        maxLength, //最大長度
        minValue, //最小值
        maxValue, //最大值
        minDate, // 最小日期
        maxDate, // 最大日期
        enumValues, //enum限定有效值
        toLowerCase = false, //是否轉換為小寫
        toUpperCase = false,
        patterns, // 一個或多個正則表達式 ex: ["[!@#$%^&*(),.?\":{}|<>]", "[A-Z]", "[a-z]", "\\d"]
        customMessages, // 自定義錯誤訊息 ex: customMessages: {"string.min": "密碼至少需要 {#limit} 個字元"}
      } = item

      // 新增：如果需要轉換為小寫
      let processedInputValue = inputValue
      if (toLowerCase && typeof inputValue === "string") {
        processedInputValue = inputValue.toLowerCase()
      }

      if (toUpperCase && typeof inputValue === "string") {
        processedInputValue = inputValue.toUpperCase()
      }

      // 設定非必填時，如果值為 undefined 或 null，則跳過驗證
      if (
        (inputValue === undefined ||
          inputValue === null ||
          inputValue === "") &&
        !isRequired
      ) {
        continue
      }

      let rule = rules[validateWay]
      if (!rule) {
        throw new Error(`Validation rule '${validateWay}' not found.`)
      }

      // 如果該欄位是必填的
      if (isRequired) {
        rule = rule.required()
      }

      if (minLength !== undefined) {
        rule = rule.min(minLength)
      }

      if (maxLength !== undefined) {
        rule = rule.max(maxLength)
      }

      if (minValue !== undefined) {
        rule = rule.min(minValue) // 對數字設定最小值
      }

      if (maxValue !== undefined) {
        rule = rule.max(maxValue) // 對數字設定最大值
      }

      if (enumValues && Array.isArray(enumValues)) {
        rule = rule.valid(...enumValues)
      }

      if (patterns && Array.isArray(patterns)) {
        patterns.forEach((pattern) => {
          rule = rule.pattern(new RegExp(pattern))
        })
      }

      if (customMessages) {
        rule = rule.messages(customMessages)
      }

      if (validateWay === "isArray" && item.itemValidateWay) {
        const itemRule = rules[item.itemValidateWay]
        if (!itemRule) {
          throw new Error(
            `Validation rule '${item.itemValidateWay}' not found.`
          )
        }
        rule = rule.items(itemRule) // 使用 itemRule 來驗證陣列內的項目
      }

      // 針對 'isDate' 驗證方式條件性應用日期範圍規則
      if (validateWay === "isDate") {
        if (minDate) {
          // 如果設定了最小日期
          rule = rule.min(minDate)
        }
        if (maxDate) {
          // 如果設定了最大日期
          rule = rule.max(maxDate)
        }
      }

      // 檢查規則是否有預設的標籤
      const defaultLabel = rule._flags.label

      schemaObj[inputName] = rule.label(labelName || defaultLabel || inputName)
    }
    const schema = Joi.object(schemaObj).unknown()
    const { error, value } = schema.validate(
      inputArray.reduce((acc, item) => {
        acc[item.inputName] = item.inputValue
        return acc
      }, {})
    )

    if (error) {
      const err = error.details[0].message.replace(/\"/g, "")
      throw new ValidationError(err)
    }

    return value
  } catch (err) {
    throw err
  }
}

module.exports = {
  validateInput,
}
