const joi = require('joi')
const schema = joi.object({
  MONGO_URI: joi.string().required()
}).unknown()
  .required()

const { error, value: vars } = joi.validate(process.env, schema);
if (error) throw new Error(`Config validation error: ${error.message}`)

const config = {
  storage: {
    mongoUri: vars.MONGO_URI
  }
}

module.exports = config
