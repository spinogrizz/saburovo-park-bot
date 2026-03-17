const mdEscape = require('markdown-escape');
const fs = require("fs");
const { execFile } = require('child_process');
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
				
		console.log(temporaryFile);
		console.log(cameraURL);

		execFile('wget', ['-q', '-T', '15', '-O', temporaryFile, cameraURL], function(err) {
			if (err) {
				console.log('[camera] Download failed:', err);
				fs.unlink(temporaryFile, function() {});
				bot.sendMessage(msg.from.id, "_Не удалось получить снимок с камеры_", { parse_mode: "markdown" });
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
	
	});
});
