const joi = require('joi');
const schema = joi.object({
  CLIENT_ID: joi.string(),
  CLIENT_SECRET: joi.string(),
  VERIFICATION_TOKEN: joi.string(),
  CALLBACK_URL: joi.string(),
  REACTION: joi.string(),
  SCOPE: joi.string(),
  TOKEN: joi.string()
}).unknown()
	.required();

const { error, value: vars } = joi.validate(process.env, schema);

if (error) {
	throw new Error(`Config validation error: ${error.message}`);
}

const config = {
	slack: {
    clientId: vars.CLIENT_ID,
    clientSecret: vars.CLIENT_SECRET,
    verificationToken: vars.VERIFICATION_TOKEN,
    token: vars.TOKEN,
    reaction: vars.REACTION,
    callbackUrl: vars.CALLBACK_URL,
    scope: vars.SCOPE
	}
};

module.exports = config;
