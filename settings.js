// settings

var settingsCommands = {
	changeName: "📝 Имя",
	changePhone: "☎️ Телефон",	
	changeEmail: "✉️ E-mail",		
	changeAddress: "🏡 Адрес"
};

var streets = {
	deadendy: { button: "⛄ Северный туп.", name: "Северный тупик", houses: [1,2,3,4,5,6,7,8,10] },
	starry: { button: "🔭 Звездная ул.", name: "Звездная", houses: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,17,18,19,20,21,22,23,24,25,26,27,29,31] },
	southy: { button: "☀️ Южная ул.", name: "Южная", houses: [2,3,4,5,6,7,8,10,11,12,13,14,15,16,18,20,22,24,26,28] },
	woody: { button: "🌳 Лесная ул.", name: "Лесная", houses: [1,2,3,4,5,6,7,8,9,10,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,30,32,34,36,38,40,42] }
};			

var settingsUserState = {
	defaultState : 0,
	changeNameState : 1,	
	changePhoneState : 2,	
	changeEmailState : 3,	
	changeAddressState : 4
}

var currentState = {}; //settingsUserState.defaultState;

var settingsKeyboard = [ 
	[  settingsCommands.changeName, settingsCommands.changeAddress ],
	[  settingsCommands.changePhone, settingsCommands.changeEmail  ],
	[ "Назад в меню" ]
];

// basic settings command
bot.onText(new RegExp('^('+commands.settings+'|\/settings)'), function (msg, match) {	
	if ( msg.chat.type != 'private' ) { 
		return; //allow to change settings only in private conversation
	}
	
	var message = "Что будем настраивать?";
	
	var redisUserKey = "users:"+msg.from.id;
	
	redis.hgetall(redisUserKey, function (err, obj) {

		// set default name based on telegram info
		if ( obj == null || obj["name"] == null ) {
			var name = msg.from.first_name + " " + msg.from.last_name;
			
			if ( name.length <= 3 ) {
				name = msg.from.username;
			}
			
			obj = { "name": name }	
			redis.hset(redisUserKey, "name", name);
		}

		message += "\n  *Имя*: " + obj["name"];
		message += "\n  *Контактный телефон*: " + ((obj["tel"] == null) ? "не указан" : obj["tel"]);
		message += "\n  *E-mail*: " + ((obj["email"] == null) ? "не указан" : obj["email"]);		
		message += "\n  *Адрес*: "
								 + ((obj["street"] == null) ? 	"не указан"	 : obj["street"]) 
								 + ((obj["house"] == null)  ? 	""			 : (", "+obj["house"]));

		var opts = {
			reply_markup: JSON.stringify({ keyboard: settingsKeyboard, resize_keyboard: true}),
			parse_mode: "markdown"
		};

		bot.sendMessage(msg.from.id, message, opts);
	});
});


// change name/phone/email command 
bot.onText(new RegExp( '^('	+ settingsCommands.changeName
					  + '|' + settingsCommands.changePhone
					  + '|' + settingsCommands.changeEmail	+ ')$'), function (msg, match)  {	
								
	if ( msg.chat.type != 'private' ) { 
		return; //allow to change settings only in private conversation
	}
	
	var state = settingsUserState.defaultState;
	var prompt = null;
	
	switch (match[0]) {
		case settingsCommands.changeName:
			state = settingsUserState.changeNameState;
			prompt = "Напишите свое имя и фамилию, чтобы ваши соседи смогли с вами познакомиться:";
			break;
		case settingsCommands.changePhone:
			state = settingsUserState.changePhoneState;		
			prompt = "Укажите свой мобильный номер, чтобы соседи смогли связаться с вами в случае чего:";
			break;
		case settingsCommands.changeEmail:
			state = settingsUserState.changeEmailState;
			prompt = "Напишите свой адрес e-mail, пожалуйста (обещаем не спамить):"			
			break;
		default:
			break;
	}
	
	setTimeout(function () {
		setCurrentState(msg.from.id, state);
	}, 100);
	
	var opts = {
			reply_markup: {
				hide_keyboard: true,
				one_time_keyboard: true
			},
			parse_mode: "markdown"
		};

	if ( prompt != null ) {
		prompt += "\n_Если передумали — напишите «отмена»._";
		bot.sendMessage(msg.from.id, prompt, opts);
	}
});


// capture normal text input when prompted for address
bot.onText(new RegExp("^[а-яA-Z \.\-]{3,50}$", 'i'), function (msg, match) {
	if ( getCurrentState(msg.from.id) == settingsUserState.changeNameState ) {
		if ( match[0] == 'отмена' ) { 
			return; //it's a special case for other handler
		}
		
		if ( msg.chat.type != 'private' ) { 
			return; //allow to change settings only in private conversation
		}
		
		if ( match[0] != null ) {
			var redisUserKey = "users:"+msg.from.id;
			var userName = match[0].replace(/\b\w/g, function(l){ return l.toUpperCase() })
			
			redis.hset(redisUserKey, "name", userName);
		}
		
		var opts = {
			reply_markup: JSON.stringify({ keyboard: settingsKeyboard, resize_keyboard: true}),
			parse_mode: "markdown"
		};

		bot.sendMessage(msg.from.id, "Приятно познакомиться! Что-нибудь еще будем настраивать?", opts);
		setCurrentState(msg.from.id, settingsUserState.defaultState);
	}
});

// capture email address when prompted for it
bot.onText(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, function (msg, match) {
	if ( getCurrentState(msg.from.id) == settingsUserState.changeEmailState ) {		
		if ( msg.chat.type != 'private' ) { 
			return; //allow to change settings only in private conversation
		}
		
		if ( match[0] != null ) {
			var redisUserKey = "users:"+msg.from.id;
			redis.hset(redisUserKey, "email", match[0]);
		}
		
		var opts = {
			reply_markup: JSON.stringify({ keyboard: settingsKeyboard, resize_keyboard: true}),
			parse_mode: "markdown"
		};

		bot.sendMessage(msg.from.id, "Отлично, спасибо! Что-нибудь еще будем настраивать?", opts);
		setCurrentState(msg.from.id, settingsUserState.defaultState);
	}
});


// capture telephone number when prompted for it
bot.onText(/^((8|\+7)[\- ]?)?(\(?\d{3}\)?[\- ]?)?[\d\- ]{7,10}$/, function (msg, match) {
	if ( getCurrentState(msg.from.id) == settingsUserState.changePhoneState ) {		
		if ( msg.chat.type != 'private' ) { 
			return; //allow to change settings only in private conversation
		}
		
		if ( match[0] != null ) {
			var redisUserKey = "users:"+msg.from.id;
			redis.hset(redisUserKey, "tel", match[0]);
		}
		
		var opts = {
			reply_markup: JSON.stringify({ keyboard: settingsKeyboard, resize_keyboard: true}),
			parse_mode: "markdown"
		};

		bot.sendMessage(msg.from.id, "Отлично, спасибо! Что-нибудь еще будем настраивать?", opts);
		setCurrentState(msg.from.id, settingsUserState.defaultState);
	}
});

// change address command
bot.onText(new RegExp('^'+settingsCommands.changeAddress), function (msg, match) {	
	if ( msg.chat.type != 'private' ) { 
		return; //allow to change settings only in private conversation
	}
	
	var keyboard = [ 
		[  streets.deadendy.button, 	streets.starry.button ],
		[  streets.southy.button, 		streets.woody.button ],
		[ "Отмена" ]
	];
	
	var opts = {
		reply_markup:  
			JSON.stringify({
				keyboard: keyboard, 
				one_time_keyboard: true,
				resize_keyboard: true
			}),
		parse_mode: "markdown"
	};

	bot.sendMessage(msg.from.id, "Выберите улицу, на которой живете:", opts);
	
	setCurrentState(msg.from.id, settingsUserState.changeAddressState);
});

// user chose street name
bot.onText(new RegExp( '^(' + streets.deadendy.button
					  + '|' + streets.starry.button
					  + '|' + streets.southy.button
					  + '|' + streets.woody.button	+ ')$'), function (msg, match)  {	

	if ( msg.chat.type != 'private' ) { 
		return; //allow to change settings only in private conversation
	}
	
	var streetKey = null;
	
	//convert button text to plain street name
	for ( var key in streets ) {
		if ( match[1] == streets[key].button ) {
			streetKey = key;
			break;
		}
	}
		
	if ( streetKey != null ) {
		setCurrentState(msg.from.id, settingsUserState.changeAddressState);
		
		var streetName = streets[key].name;
		
		var redisUserKey = "users:"+msg.from.id;
		redis.hset(redisUserKey, "street", streetName);
		
		bot.sendPhoto(msg.from.id, "./images/map_"+streetKey+".png");
	}
			
	var opts = {
		reply_markup: {
			hide_keyboard: true
		},
		parse_mode: "markdown"
	};

	bot.sendMessage(msg.from.id, "Хорошо, теперь напишите ваш номер дома и квартиры в виде «дом/квартира», например *25/3*.\n\
Указывайте адрес по новому стилю, не по корпусам.\n\
_Если передумали — напишите «отмена»._", opts);
});

// user prompted house number
bot.onText(/^(\d{1,2})\/(\d)$/, function (msg, match) {	
	if ( getCurrentState([msg.from.id]) == settingsUserState.changeAddressState ) {
		var redisUserKey = "users:"+msg.from.id;
		
		redis.hget(redisUserKey, "street", function (err, value) {
			var streetKey = null;
				
			//convert street name to symbolic street key 
			for ( var key in streets ) {
				if ( value == streets[key].name ) {
					streetKey = key;
					break;
				}
			}
//			
//			console.log(streetKey);
//			console.log(streets[streetKey].houses);
//			console.log(parseInt(match[i]));
			
			if ( streetKey != null ) {
				var houseIndex = streets[streetKey].houses.indexOf(parseInt(match[1]));
				
				
				if ( houseIndex == -1 || parseInt(match[2]) > 8 ) {
					var streetName = streets[streetKey].name;
					
					bot.sendMessage(msg.from.id, "На улице " + streetName + " нет такого адреса. Сверьтесь с картой и попробуйте снова.\n\
_Если передумали — напишите «отмена»._", {parse_mode: "markdown"});
						
					return;
				}
				
				if ( match[0] != null ) {
					redis.hset(redisUserKey, "house", match[0]);
				}
				
				var opts = {
					reply_markup: JSON.stringify({ keyboard: settingsKeyboard, resize_keyboard: true}),
					parse_mode: "markdown"
				};

				bot.sendMessage(msg.from.id, "Отлично! Что-нибудь еще будем настраивать?", opts);
				
				setCurrentState(msg.from.id, settingsUserState.defaultState);
			}
		});		
	}		
});


// reset state on cancel
bot.onText(new RegExp('^(отмена|\/cancel|назад в меню)', 'i'), function (msg, match) {
	setCurrentState(msg.from.id, settingsUserState.defaultState);
});

function setCurrentState(id, state) {
	if ( currentState[id] == undefined ) {
		currentState[id] = {};
	}
	
	currentState[id] = state;
}

function getCurrentState(id) {
	return currentState[id];
}

