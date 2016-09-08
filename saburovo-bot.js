const fs = require("fs");
require("./token.js")(); //import API token

var TelegramBot = require('node-telegram-bot-api');
var bot = new TelegramBot(token, {polling: true});

var commands = {
	contacts: "📞 Контакты",
	links: 	"📋 Полезности"	,
	rides: "🚗 Попутчики",
	gazvoda: "🔥🚿 Счетчики",
	settings: "⚙ Настройки"
}


// contacts
bot.onText(new RegExp('^('+commands.contacts+'|\/contacts)$'), function (msg, match) {
	var fromId = msg.from.id;
	
	fs.readFile('./contacts.md', function (err, data) {
		var opts = {parse_mode: 'markdown'};
		
		sendMessageWithDefaultMenu(data, fromId, opts);
	});

});

function sendMessageWithDefaultMenu(msg, userID, opts) { 	
	var defaultKeyboard = [ 
		[	commands["contacts"], commands["links"]		], 
		[	commands["rides"],	commands["gazvoda"]		], 
		[	commands["settings"] 	]
	];
	
	var newOpts = opts;
	
	if ( !newOpts ) {
		newOpts = {}
	}
	
	newOpts["reply_markup"] = 
			JSON.stringify({
				"keyboard": defaultKeyboard, 
				"one_time_keyboard": false,
			});
		
	bot.sendMessage(userID, msg, newOpts);
}