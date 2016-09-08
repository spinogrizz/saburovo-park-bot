const fs = require("fs");
require("./token.js")(); //import API token

var TelegramBot = require('node-telegram-bot-api');
var bot = new TelegramBot(token, {polling: true});

var commands = {
	contacts: "📞 Контакты",
	links: 	"📋 Полезности"	,
	rides: "🚗 Попутчики β",
	gazvoda: "🔥🚿 Счетчики β",
	settings: "⚙ Настройки β"
}

// start {
bot.onText(/\/start/, function (msg, match) {	
	sendMessageWithDefaultMenu("Вот с чем я могу помочь:", msg.from.id);			
});

// contacts
bot.onText(new RegExp('^('+commands.contacts+'|\/contacts)'), function (msg, match) {
	fs.readFile('./contacts.md', function (err, data) {
		var opts = {parse_mode: 'markdown'};
	
		if ( msg.chat.type == 'group' ) { 
			bot.sendMessage(msg.chat.id, data, opts);
		} else if ( msg.chat.type == 'private' ){
			sendMessageWithDefaultMenu(data, msg.from.id, opts);			
		}
	});

});

function sendMessageWithDefaultMenu(msg, toID, opts) { 	
	var defaultKeyboard = [ 
		[  commands["contacts"],  commands["links"]	   ], 
		[  commands["rides"],     commands["gazvoda"]  ], 
		[  commands["settings"]  ]
	];
	
	var newOpts = opts;
	
	if ( !newOpts ) {
		newOpts = {}
	}
	
	newOpts["reply_markup"] = 
			JSON.stringify({
				"keyboard": defaultKeyboard, 
				"one_time_keyboard": false,
				selective: true
			});
		
	bot.sendMessage(toID, msg, newOpts);
}