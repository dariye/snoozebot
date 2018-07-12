const ngrok = require('ngrok');
const { subdomain, server: { port } } = require('../config');
let URL;

ngrok.connect({
	addr: port,
	subdomain: subdomain.name
}, (err, url) => {
	URL = url;
	if (err) {
		console.error(`[NGROK][ERROR] Could not start ngrok: ${JSON.stringify(err)}`);
	} else {
		console.log(`[NGROK] Started on ${url} - inspect here (http://127.0.0.1:4040)`);
	}
});
process.once('SIGUSR2', () => {
	ngrok.disconnect(URL);
	ngrok.kill();
	process.kill(process.pid, 'SIGUSR2');
});
