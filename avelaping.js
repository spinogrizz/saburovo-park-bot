var ping = require('ping');
const fs = require('fs'); 

var hosts = [
	'193.242.177.230', //Д
	'193.242.177.240', //Т
	'193.242.177.246', //Н
	'193.242.176.130', //ДП
];

var internetState = {
	stateUnknown : 0,
	stateNoInternet : 1,
	stateSomeInternetAvailable : 2,	
	stateInternetWorks : 3,	
}

var lastStateUpdate = undefined;
var currentState = internetState.stateUnknown;

var usersToNotify = [ //241065, //author
					  -1001070050013, //main chat
					  1237321936, //avelacom support
					];

function pingpong() {
	var processed = 0;
	var alive = 0;
	
	hosts.forEach(function(host){
		
		ping.sys.probe(host, function(isAlive) {
			
			if ( isAlive == null || isAlive == undefined ) {
				isAlive = false
			}

			console.log(host, isAlive);

			if ( isAlive ) {
				alive++;
			}
									
			if ( ++processed >= hosts.length ) {
				var date = new Date();
				var timestamp = date.getTime();
				var percentage = Math.round((alive/processed)*100);

				var data = timestamp + ',' + percentage + '\n';
				
				fs.appendFile('uptime.log', data, (err) => {
					if ( err ) { console.log(err); }
				});

				var lastState = currentState;

				if ( percentage >= 40 ) {
					currentState = internetState.stateInternetWorks;
				} else if ( percentage >= 20 ) {
					currentState = internetState.stateSomeInternetAvailable;
				} else {
					currentState = internetState.stateNoInternet;
				}

				lastStateUpdate = date.getTime();

				if ( lastState != currentState ) {
					notify_internet(lastState, currentState);
				}
			}
		}, { 'timeout': 10 } );
	});	
}

function intenetStateToText(state) {
	var now = new Date();

	if (   lastStateUpdate == undefined 
		|| state == internetState.stateUnknown
		|| now.getTime() - lastStateUpdate > 5*60*1000 ) 
	{
		state = internetState.stateUnknown;		
		return "_Состояние провайдера неизвестно, попробуйте позже_";
	} else {	
		switch (state) {
			case internetState.stateNoInternet:
				return "🔴 Провайдер Avelacom *не доступен* в поселке";
				break;

			case internetState.stateSomeInternetAvailable:
				return "⚪ Подключение к Avelacom *доступно не во всех домах*";
				break;

			case internetState.stateInternetWorks:			
				return "🔵 Подключение к Avelacom *работает в штатном режиме*";
				break;
		}
	}
}

bot.onText(new RegExp('^(\/avelaping|авелаком|интернет|'+global.commands.avelacom+')$', 'i'), function (msg, match) {	
	if ( msg.chat.type != 'private' ) { 
		return; //allow request only in private conversation
	}


	var reply = intenetStateToText(currentState);

	if ( reply != undefined ) {
		bot.sendMessage(msg.chat.id, reply, {parse_mode: "markdown"});
	}
});


function notify_internet(ls, cs) {
	if (    ls == internetState.stateUnknown 
	 	 || cs == internetState.stateUnknown ) {
		return;
	}

	if ( cs == internetState.stateInternetWorks || cs == internetState.stateNoInternet ) {
		var reply = intenetStateToText(currentState);

		if ( reply != undefined ) {

			for ( var i in usersToNotify ) {
			 	var user_id = usersToNotify[i];
			 	bot.sendMessage(user_id, reply, {parse_mode: "markdown"});
			}
			
		}
	}
}	

setInterval(pingpong, 30000);
pingpong();
