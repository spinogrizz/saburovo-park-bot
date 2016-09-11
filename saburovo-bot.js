const fs = require("fs");
require("./token.js")(); //import API token

var node_redis = require('redis');
global.redis = node_redis.createClient();

var TelegramBot = require('node-telegram-bot-api');
global.bot = new TelegramBot(token, {polling: true});

global.commands = {
	contacts: "📞 Контакты",
	links: 	"📋 Полезности"	,
	rides: "🚗 Попутчики β",
	gazvoda: "🔥🚿 Счетчики β",
	settings: "🔧 Настройки"
}

require("./settings.js");

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
				keyboard: defaultKeyboard, 
				one_time_keyboard: false,
				selective: true,
				resize_keyboard: true
			});
		
	bot.sendMessage(toID, msg, newOpts);
}

bot.onText(new RegExp('^(отмена|\/cancel|назад в меню)', 'i'), function (msg, match) {
	if ( msg.chat.type == 'private' ){
		sendMessageWithDefaultMenu("Хорошо, чем могу быть еще полезен?", msg.from.id);			
	}
	
	//console.log("main cancel");
});