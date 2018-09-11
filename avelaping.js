var ping = require('ping');
const fs = require('fs'); 

var hosts = [
	'193.242.177.230', //Д
	'193.242.177.240', //Т
	'193.242.177.246', //Н
	'193.242.177.227', //Г
];

var lastStateUpdate = undefined;
var currentState = undefined;

var internetState = {
	stateUnknown : 0,
	stateNoInternet : 1,
	stateSomeInternetAvailable : 2,	
	stateInternetWorks : 3,	
}

function pingpong() {
	var processed = 0;
	var alive = 0;
	
	hosts.forEach(function(host){
		
		ping.sys.probe(host, function(isAlive) {
			
			if ( isAlive ) {
				alive++;
			}
									
			if ( ++processed == hosts.length ) {
				var date = new Date();
				var timestamp = date.getTime();
				var percentage = Math.round((alive/processed)*100);

				var data = timestamp + ',' + percentage + '\n';
				
				fs.appendFile('uptime.log', data);

				if ( percentage >= 60 ) {
					currentState = internetState.stateInternetWorks;
				} else if ( percentage >= 20 ) {
					currentState = internetState.stateSomeInternetAvailable;
				} else {
					currentState = internetState.stateNoInternet;
				}

				lastStateUpdate = date.getTime();
			}
		});
	});	
}

bot.onText(new RegExp('^(авелаком|интернет)$'), function (msg, match) {	
	if ( msg.chat.type != 'private' ) { 
		return; //allow request only in private conversation
	}

	var now = new Date();
	var reply = undefined;

	if (   lastStateUpdate == undefined 
		|| currentState == internetState.stateUnknown
		|| now.getTime() - lastStateUpdate > 5*60*1000 ) 
	{
		reply = "_Состояние провайдера неизвестно, попробуйте позже_";
		currentState = internetState.stateUnknown;
	} else {

		switch (currentState) {
			case internetState.stateNoInternet:
				reply = "🔴 Провайдер Avelacom *не доступен* в поселке";
				break;

			case internetState.stateSomeInternetAvailable:
				reply = "⚪ Подключение к Avelacom *доступно не во всех домах*";
				break;

			case internetState.stateInternetWorks:			
				reply = "🔵 Подключение к Avelacom *работает в штатном режиме*";
				break;
		}
	}

	if ( reply != undefined ) {
		var opts = {
			parse_mode: "markdown"
		};

		bot.sendMessage(msg.chat.id, reply, opts);
	}
});

setInterval(pingpong, 30000);
pingpong();