if (process.env.NODE_ENV !== 'production') {
	require('dotenv-safe').config({
    path: '.env.dev',
    example: '.env.dev.example'
	})
}
const common = require('./components/common');
const server = require('./components/server');
const ngrok = require('./components/ngrok');
const slack = require('./components/slack');
const storage = require('./components/storage');

module.exports = Object.assign({}, common, server, ngrok, slack, storage);
