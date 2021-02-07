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
				
		console.log(temporaryFile);
		console.log(cameraURL);
		
		request(cameraURL)
		.pipe(fs.createWriteStream(temporaryFile))
		.on('finish', function() {
			bot.sendPhoto(msg.from.id, temporaryFile);
			
			setTimeout(function () {
				fs.unlinkSync(temporaryFile);
			}, 1000)
			
		});
	
	});
});

