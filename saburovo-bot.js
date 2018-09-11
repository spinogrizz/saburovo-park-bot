const fs = require("fs");
require("./token.js")(); //import API token

var node_redis = require('redis');
global.redis = node_redis.createClient();

var TelegramBot = require('node-telegram-bot-api');
global.bot = new TelegramBot(token, {
					polling: true,
					request: {
					   proxy: "http://localhost:8118",
					}
				});

console.log(global.bot);

global.commands = {
	contacts: "📞 Контакты",
	links: 	"📋 Полезности"	,
	search: "👪 Соседи",
	gazvoda: "🔥🚿 Счетчики β",
	settings: "🔧 Настройки"
}
//
require("./settings.js");
require("./search.js");
require("./avelaping.js");

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
		[  commands.contacts,   commands.links	  ], 
		[  commands.search,     commands.gazvoda  ], 
		[  commands.settings  ]
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
});

bot.onText(global.password, function (msg, match) {	
	if ( msg.chat.type != 'private' ) { 
		return; //allow auth only in private conversation
	}
	
	var redisUserKey = "users:"+msg.from.id;
	
	redis.hget(redisUserKey, "auth", function (err, obj) {
		var opts = {parse_mode: 'markdown'};
		
		if ( obj == null ) {
			redis.hset(redisUserKey, "auth", "1");
						
			var message = "*Спасибо*!\n_Вы теперь можете полноценно пользоваться ботом и всеми его функциями._"
			sendMessageWithDefaultMenu(message, msg.from.id, opts);			
		} else {
			bot.sendMessage(msg.chat.id, "_Вы уже были авторизованы ранее._", opts);			
		}
		

	});
});

global.checkAuthentication = function (userID, callback) {
	var redisUserKey = "users:"+userID;

	redis.hgetall(redisUserKey, function (err, obj) {
		if ( obj != null && obj["auth"] != null ) {
			callback(true);
		} else if ( obj != null && obj["house"] != null ) {
			redis.hset(redisUserKey, "auth", "1");
			callback(true);
		} else {
			message = "Данная функция доступна только авторизованным пользователям.\n_Узнайте пароль у соседей и напишите его сюда_.";
			bot.sendMessage(userID, message, {parse_mode: "markdown"});
			
			callback(false);
		}
	});
};
