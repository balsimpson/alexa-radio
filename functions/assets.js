
const fs = require('fs');
// Load a picture
let favicon = fs.readFileSync('./data/favicon.ico');
let display_img_bg = fs.readFileSync('./data/background.png');
let display_img_station = fs.readFileSync('./data/station.png');
let audio_stream_failed = fs.readFileSync('./data/stream_failed.mp3');

/**
* A basic Hello World function
* @param {string} asset Name of the icon
* @returns {object.http}
*/
module.exports = async (asset = '') => {

	let response = {
		headers: { 'content-type': 'image/ico' },
		body: {}
	};

	switch (asset) {
		case 'favicon':
			response.headers = { 'content-type': 'image/ico' };
			response.body = favicon;
			break;
		case 'background':
			response.headers = { 'content-type': 'image/png' };
			response.body = display_img_bg;
			break;
		case 'station':
			response.headers = { 'content-type': 'image/png' };
			response.body = display_img_station;
			break;
		case 'failed':
			response.headers = { 'content-type': 'audio/mp3' };
			response.body = audio_stream_failed;
			break;

		default:
			break;
	}

	return response;
};
