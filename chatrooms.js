var mdEscape = require('markdown-escape');

var chatrooms = {
	main: "📣 Основные",
	thematic: "🎲 Тематические",	
	cooperative: "💼 Кооператив",
	household: "🏠 Домовладение",
	goods: "🛒 Товары и услуги",
	channels: "📜 Каналы"
};

var chatroomsUserState = {
	defaultState : 0,
}

var currentState = {}; //chatroomsUserState.defaultState;


//list of chatrooms
bot.onText(new RegExp('^('+commands.groups+'|\/groups)'), function (msg, match) {	
	if ( msg.chat.type != 'private' ) { 
		return; //allow to use this command only in private chat
	}
		
	global.checkAuthentication(msg.from.id, function(result) {
		if ( result == false ) {
				return;
		}
			
		var chooseModeKeyboard = [ 
			[  chatrooms.main, chatrooms.thematic, chatrooms.cooperative ],
			[  chatrooms.household, chatrooms.goods, chatrooms.channels ],			
			[ "Назад в меню" ]
		];

		//console.log(chooseModeKeyboard);

		var opts = {
			reply_markup: { 
				keyboard: chooseModeKeyboard,
				one_time_keyboard: false,
				resize_keyboard: true			
			},
			parse_mode: "markdown",
		};

		var message  = "Выберите сообщества, которые вас интересуют.\n";
		    message += "Если вы не нашли подходящую группу в данном списке, обратитесь к @Spinogrizz или @Vit_Someo с предложением создать новую группу.";

		bot.sendMessage(msg.from.id, mdEscape(message), opts);
	});
});


bot.onText(new RegExp('^('+chatrooms.main+'|'
						  +chatrooms.thematic+'|'
						  +chatrooms.cooperative+'|'
						  +chatrooms.household+'|'
						  +chatrooms.goods+'|'
						  +chatrooms.channels+')'), function (msg, match) {	
	var message = msg;
	
	if ( msg.chat.type != 'private' || msg.from === undefined ) { 
		return; //allow to use this command only in private chat
	}
		
	global.checkAuthentication(msg.from.id, function(result) {
		if ( result == false ) {
			return;
		}
		
		var messageText = "";
		var chatroomCategory = "";
		
		var chatroomHandle = match[1];		
		var chatroomCategory = Object.keys(chatrooms).find(key => chatrooms[key] === chatroomHandle);		
		
		
		var messageText = global.chatrooms[chatroomCategory].description + "\n\n";
		var rooms = global.chatrooms[chatroomCategory].links;
				
		var inlineKeyboard = [ [] ];
		
		for ( var i in rooms ) {
			var roomInfo = rooms[i];
			
			messageText += "_" + roomInfo.title + "_ — " + roomInfo.description + "\n";
			
			inlineKeyboard[inlineKeyboard.length-1].push(
				{ text: roomInfo.title, url: roomInfo.inviteLink }
			);
			
			if ( i % 2 == 1 && i != 0 ) {
				inlineKeyboard.push([]);
			}
		}
		
		messageText += "\n";
		
		var opts = {
			reply_markup: {
				inline_keyboard: inlineKeyboard
			},
			parse_mode: "markdown",
		};
		
		bot.sendMessage(msg.from.id, messageText, opts);

	});
});