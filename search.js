var searchUserState = {
	defaultState : 0,
	searchEntryState : 1
}

var currentState = {}; //searchUserState.defaultState;

var buildings = require("./buildings.js").buildings;

var searchKeyboard = [ "🔎 Искать ещё", "Назад в меню" ];

var mdEscape = require('markdown-escape');

// basic settings command
bot.onText(new RegExp('^('+commands.search+'|\/search)'), function (msg, match) {	
	if ( msg.chat.type != 'private' ) { 
		return; //allow search only in private conversation
	}
	
	global.checkAuthentication(msg.from.id, function(result) {
		if ( result == false ) {
			return;
		}
	
		var redisUserKey = "users:"+msg.from.id;

		redis.hgetall(redisUserKey, function (err, obj) {
			var message = null;
			
			if ( obj == null || obj["name"] == null || obj["house"] == null ) {			
				message = "Чтобы воспользоваться этой функцией, нужно сначала с помощью команды /settings настроить свой профиль и указать там свое имя и адрес.";
				bot.sendMessage(msg.chat.id, message, {});
			} else {
				var opts = {
					reply_markup: {
						hide_keyboard: true,
						one_time_keyboard: false
					},
					parse_mode: "markdown"
				};

				message = "Чтобы найти соседей, введите один из следующих запросов:\n\
				*корпус 70* — для поиска соседей по № корпуса\n\
				*лесная 5* — для поиска соседей по адресу\n\
				*1258* — для поиска по ключевым словам, например номеру школы";

				if ( message != null ) {
					message += "\n\n_Если передумали — напишите «отмена»._";
					bot.sendMessage(msg.chat.id, message, opts);
					
					setTimeout(function () {
						setCurrentState(msg.from.id, searchUserState.searchEntryState);
					}, 100);
				}			
			}		
		});
	});
});

// search by building number
var buildingRegexp = "^корпус (\\d{1,2}[aа]*)";
bot.onText(new RegExp(buildingRegexp, 'i'), function (msg, match) {	
	if ( getCurrentState(msg.from.id) != searchUserState.searchEntryState ) {
		return;
	}
	
	if ( msg.chat.type != 'private' ) { 
		return; //allow search only in private conversation
	}

	var bldNumber = match[1].toLowerCase().replace(/a/, "а");
	var buildingInfo = buildings[bldNumber];

	if ( buildingInfo != null ) {
		searchNeighborsByAddress(msg.from.id, buildingInfo.street, buildingInfo.house);
	}
});

// search by full address
var addressRegexp = '^(лесн|южн|север|зв[её]зд)[^\\d]+(\\d{1,2})$';
bot.onText(new RegExp(addressRegexp, 'i'), function (msg, match) {	
	if ( getCurrentState(msg.from.id) != searchUserState.searchEntryState ) {
		return;
	}

	if ( msg.chat.type != 'private' ) { 
		return; //allow search only in private conversation
	}
	
	var strt = match[1];
	var house = match[2];
	var street = null;

	switch (strt.toLowerCase()) {
		case "лесн":
			street = "Лесная";
			break;		
		case "южн":
			street = "Южная";		
			break;		
		case "север":
			street = "Северный тупик";
			break;		
		case "звёзд":
		case "звезд":		
			street = "Звёздная";		
			break;
	}
	
	if ( street != null ) {
		searchNeighborsByAddress(msg.from.id, street, house);
	}
});

// full text search 
bot.onText(/^[^\/].{1,}/, function (msg, match) {	
	// work only in search state
	if ( getCurrentState(msg.from.id) != searchUserState.searchEntryState ) { return; }
	
	// don't capture commands
	if ( match[0].indexOf("/") == 0 ) { return; } 

	// don't capture cancel commands
	if ( match[0].match(/(отмена|назад в меню)/i) != null ) { return; } 

	// don't capture 'retry search' command
	if ( match[0].match(new RegExp(searchKeyboard[0], 'i')) != null ) { return; } 
	
	// don't capture public messages
	if ( msg.chat.type != 'private' ) { return; }
	
	//don't catch search address requests
	if (match[0].match(new RegExp(addressRegexp, 'i')) != null) { return; }
	
	//don't catch search building requests
	if (match[0].match(new RegExp(buildingRegexp, 'i')) != null) { return; } 
		
	searchNeighborsByText(msg.from.id, match[0]);
});


function searchNeighborsByText(userID, text) {
	var searchOpts = {
			name: text,
			bio: text,
			kids: text
	};
		
	findUsersWithParams(searchOpts, false, function (count, searchResultID, onlyOne) {		
			if ( count > 0 ) {		
				presentUserSearchResults(userID, count, searchResultID);
			} else {
				showNothingFound(userID, text);
			}
	});
}

function searchNeighborsByAddress(userID, street, house) {
	var searchOpts = {
		street: street,
		house: "^"+house+"/"
	};
	
	findUsersWithParams(searchOpts, true, function (count, searchResultID) {		
		if ( count > 0 ) {		
			presentUserSearchResults(userID, count, searchResultID);
		} else {
			showNothingFound(userID, street+", "+house);
		}
	});
}

function findUsersWithParams(dict, shouldAllMatch, callback) {	
	redis.keys('users:*', function (err, userKeys) {
		var foundUserIDs = [];
		
		var batch = redis.batch();
		var j = 0;

		for ( var i = 0; i < userKeys.length; i++ ) {
			var key = userKeys[i];
			
			batch.hgetall(key, function (err, userObj) {
				if ( userObj != null ) {						
					var passes = shouldAllMatch ? true : false;
					
					for ( var searchKey in dict ) {
						if ( userObj[searchKey] == null ) {
							passes = false;
							
							if ( shouldAllMatch ) { break; } else { continue; }
						}
						
						var match = userObj[searchKey].match(new RegExp(dict[searchKey], 'gi'));						
						
						if ( shouldAllMatch ) {
							passes = passes && (match != null);
						} else if ( match != null ) {
							passes = true;
							break;
						}
					}
					
					if ( passes ) {
						foundUserIDs.push(userKeys[j].substr(6));  //users:1234 -> 1234
					}
				}	
				
				j++; //internal concurrent counter	
			});
		}

		batch.exec(function(err, resp) {
			if ( foundUserIDs.length > 0 ) {			
				var searchResultID = (new Date().getTime().toString()) + Math.floor(Math.random()*1000).toString();
									
				for ( var i = 0; i < foundUserIDs.length; i++ ) {
					redis.lpush("search:"+searchResultID, foundUserIDs[i]);	
				}			
				
				redis.expire("search:"+searchResultID, 4*60*60);
			}
			
			callback(foundUserIDs.length, searchResultID);
		});
	});
}

function presentUserSearchResults(toUserID, count, searchResultsID) {
	if ( count == 0 ) {
		return;
	}

	var cnt = 0;		
	var opts = {
		parse_mode: "markdown"
	};

	if ( count > 1 ) {
		opts["reply_markup"] = {
			inline_keyboard: [ createInlineButtons(0, count, searchResultsID) ]		
		};
	}

	var firstUser = getSearchResultByID(searchResultsID, 0, function (length, userObj) {
		message = createUserDescription(userObj, toUserID);
		bot.sendMessage(toUserID, message, opts);
	
		//setCurrentState(toUserID, searchUserState.defaultState);
		
		opts["reply_markup"] = {
			keyboard: [ searchKeyboard ],
			resize_keyboard: true,
			one_time_keyboard: true
		};
		
		bot.sendMessage(toUserID, "Вот что удалось найти, будем еще что-нибудь искать?", opts);
	});
}

function showNothingFound(toUserID, searchQuery) {
	var opts = {
		reply_markup: {
			hide_keyboard: true,
			keyboard: [ searchKeyboard ],
			resize_keyboard: true,
			one_time_keyboard: true
		},
		parse_mode: "markdown"
	};

	message = "По запросу «"+searchQuery+"» ничего не найдено, попробуйте еще раз.\n_Если передумали — напишите «отмена»._";
	bot.sendMessage(toUserID, message, opts);
}

bot.onText(new RegExp("^"+searchKeyboard[0]+"$"), function (msg, match) {	
	if ( msg.chat.type != 'private' ) { 
		return; //allow search only in private conversation
	}
	
	var opts = {
		reply_markup: {
			hide_keyboard: false
		},
		parse_mode: "markdown"
	}
	
	message = "Хорошо, попробуйте повторить свой запрос.\n_Если передумали — напишите «отмена»._";
	bot.sendMessage(msg.from.id, message, opts);
	
	setTimeout(function () {
		setCurrentState(msg.from.id, searchUserState.searchEntryState);
	}, 100);
});

bot.on('callback_query', function(msg) {
	if ( msg.data == null || msg.data.length == 0 ) {
		return;
	}

	if ( msg.data == "listBegins" ) {
		bot.answerCallbackQuery(msg.id, "Это начало списка", true);
	} else if ( msg.data == "listEnds" ) {
		bot.answerCallbackQuery(msg.id, "Это конец списка", true);
	} else if ( msg.data == "nop") {
		bot.answerCallbackQuery(msg.id, "", false);
	} else {
		var matches = msg.data.match(/^search([\>\<])(\d+)\@(.+)$/);
		
		if ( matches ) {		
			var cnt = parseInt(matches[2]);
			var searchID = parseInt(matches[3]);				
			
			getSearchResultByID(searchID, cnt, function (length, userObj) {
				if ( cnt >= 0 && length > 0 && cnt < length ) {
					var newDesc = createUserDescription(userObj, msg.from.id);
					
					var opts = {
						reply_markup: {
							inline_keyboard: [ createInlineButtons(cnt, length, searchID) ],
						},
						parse_mode: "markdown",
						message_id:  msg.message.message_id,
						chat_id: msg.message.chat.id
					};
					
					redis.expire("search:"+searchID, 4*60*60);
					
					bot.editMessageText(newDesc, opts);					
				} else {
					bot.answerCallbackQuery(msg.id, "Результат этого поиска уже устарел", true);	
				}	
			});
			
		}
	}		
});

function createInlineButtons(position, length, resultID) {
	var backBtn = { text: "<< ", callback_data: "search<"+(position-1)+"@"+resultID };
	var frwdBtn = { text: " >>", callback_data: "search>"+(position+1)+"@"+resultID };

	var middle  = { text: (position+1) + " из " + length, callback_data: "nop" };
	
	if ( position == 0 ) {
		backBtn.text = "   ";
		backBtn.callback_data = "listBegins";
	} 
	
	if ( position == length-1 ) {
		frwdBtn.text = "   ";
		frwdBtn.callback_data = "listEnds";
	}
		
	if ( length == 1 ) {
		return null;
	} else {
		return [ backBtn, middle, frwdBtn ]
	}	
}

function createUserDescription(user, forUserID) {
	var desc = "*" + user["name"] + "*";
		
	if ( user["house"] != null ) { desc += "\n" + user["street"] + ", " + user["house"] + "\n"; }
	if ( user["username"] != null ) { desc += "\n💬 @" + mdEscape(user["username"]); }	
	
	//show tel number only to admins
	if ( global.admins && global.admins.indexOf(parseInt(forUserID)) != -1 ) { 
		if ( user["tel"] != null ) { desc += "\n☎️ " + user["tel"]; }
	}
	
	if ( user["email"] != null ) { desc += "\n✉️ " + user["email"]; }
	if ( user["kids"] != null ) { desc += "\n👶 " + mdEscape(user["kids"]); }
	if ( user["bio"] != null ) { desc += "\n📖 " + mdEscape(user["bio"]); }	
	
	return desc;
}

function getSearchResultByID(searchResultID, position, callback) {
	var redisKey = "search:"+searchResultID;
	
	redis.llen(redisKey, function (err, length) {
		if ( position >= 0 && length > 0 && position < length ) {
			redis.lindex(redisKey, position, function (err, userKey) {
				redis.hgetall("users:"+userKey, function (err, userObj) {
					callback(length, userObj);				
				});				
			});
		} else {
			callback(0, null);
		}
	});
}

// reset state on cancel
bot.onText(new RegExp('^(отмена|\/cancel|назад в меню)', 'i'), function (msg, match) {
	setCurrentState(msg.from.id, searchUserState.defaultState);
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

