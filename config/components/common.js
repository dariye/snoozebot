const joi = require('joi');
const schema = joi.object({
	NODE_ENV: joi.string()
		.allow(['development', 'production', 'test', 'provision'])
		.required()
}).unknown()
	.required();

const { error, value: vars } = joi.validate(process.env, schema);

if (error) {
	throw new Error(`Config validation error: ${error.message}`);
}

const config = {
	env: vars.NODE_ENV
};

module.exports = config;
