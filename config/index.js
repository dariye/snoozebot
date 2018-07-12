if (process.env.NODE_ENV !== 'production') {
	require('dotenv-safe').config({
		path: '.env.dev'
	});
}

const common = require('./components/common');
const server = require('./components/server');
const ngrok = require('./components/ngrok');
const slack = require('./components/slack');

module.exports = Object.assign({}, common, server, ngrok, slack);
