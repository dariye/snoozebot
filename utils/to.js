/*
 * A utility function to handle values from promises
 * @async
 * @param {Promise} - promise
 * @returns {Promise|Error} result
 */
function to(promise) {
	return promise.then((data) => {
		const err = null;
		return [err, data];
	})
		.catch((err) => [err]);
}

module.exports = to;
