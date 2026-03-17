const mdEscape = require('markdown-escape');
const fs = require("fs");
const request = require('request');
const tmp = require('tmp');

//list of chatrooms
bot.onText(new RegExp('^('+commands.trashcam+'|\/trashcam|помойка)'), function (msg, match) {	
	if ( msg.chat.type != 'private' ) { 
		return; //allow to use this command only in private chat
	}
		
	global.checkAuthentication(msg.from.id, function(result) {
		if ( result == false ) {
			return;
		}
		
		var cameraURL = global.cameras[0]; //only one camera right now
		var temporaryFile = "/tmp/camera_0_" + msg.from.id + ".jpg";
		var downloadFailed = false;
				
		console.log(temporaryFile);
		console.log(cameraURL);

		var download = request(cameraURL);
		var output = fs.createWriteStream(temporaryFile);

		download.on('response', function(response) {
			if (response.statusCode !== 200) {
				downloadFailed = true;
				console.log('[camera] Unexpected status code: ' + response.statusCode);
				download.abort();
				output.destroy();
				fs.unlink(temporaryFile, function() {});
				bot.sendMessage(msg.from.id, "_Не удалось получить снимок с камеры_", { parse_mode: "markdown" });
			}
		});

		download.on('error', function(err) {
			downloadFailed = true;
			console.log('[camera] Download failed:', err);
			output.destroy();
			fs.unlink(temporaryFile, function() {});
			bot.sendMessage(msg.from.id, "_Не удалось получить снимок с камеры_", { parse_mode: "markdown" });
		});

		output.on('error', function(err) {
			downloadFailed = true;
			console.log('[camera] Write failed:', err);
			download.abort();
			fs.unlink(temporaryFile, function() {});
			bot.sendMessage(msg.from.id, "_Не удалось сохранить снимок с камеры_", { parse_mode: "markdown" });
		});

		output.on('finish', function() {
			if (downloadFailed) {
				return;
			}

			fs.stat(temporaryFile, function(err, stats) {
				if (err || !stats || stats.size === 0) {
					console.log('[camera] Invalid snapshot file:', err || 'empty file');
					fs.unlink(temporaryFile, function() {});
					bot.sendMessage(msg.from.id, "_Снимок с камеры получился пустым_", { parse_mode: "markdown" });
					return;
				}

				bot.sendPhoto(msg.from.id, temporaryFile)
					.catch(function(err) {
						console.log('[camera] Failed to send photo:', err);
						bot.sendMessage(msg.from.id, "_Не удалось отправить снимок в Telegram_", { parse_mode: "markdown" });
					})
					.finally(function() {
						fs.unlink(temporaryFile, function() {});
					});
			});
		});

		download.pipe(output);
	
	});
});
