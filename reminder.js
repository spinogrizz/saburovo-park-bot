const chatID = -758958086
const regularMessage = "🔥💧 Не забудьте подать показания счетчиков в [расчетный центр](https://saburovopark.ru/lk) до конца месяца"
const lastDayMessage = "🔥💧 Сегодня последний день подачи показания счетчиков в [расчетный центр](https://saburovopark.ru/lk)"

function remind_counters() {
	var today = new Date(new Date().toLocaleString("en-US", {timeZone: "Europe/Moscow"}))
	
	var messageToSend = undefined
	
	if (   today.getDate() == 20
		&& today.getHours() == 20
		&& today.getMinutes() == 0 )
	{
		var lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
	
		if ( today.getDate() == lastDayOfMonth.getDate() ) {
			messageToSend = lastDayMessage
		} else {
			messageToSend = regularMessage
		}
	}
		
		
	if ( messageToSend != undefined ) {
		bot.sendMessage(chatID, messageToSend, {parse_mode: "markdown"}).then(function(res) {
			const msgID = res.message_id
			
			bot.pinChatMessage(chatID, msgID).then(function(pinRes) {
				
				setTimeout(function() {
					bot.unpinChatMessage(chatID, {message_id: msgID})
				}, 30*60*1000)
			})
		})
	}
}

remind_counters()
setInterval(remind_counters, 45*1000)