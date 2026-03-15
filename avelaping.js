var ping = require('ping');
const fs = require('fs');

var hosts = [
	'193.242.177.230', //Д
	'193.242.177.240', //Т
	'193.242.177.246', //Н
	'193.242.176.130', //ДП
];

// Популярные РФ ресурсы для проверки интернета у хостера
var internetCheckHosts = [
	'ya.ru',
	'vk.com',
	'mail.ru',
	'ozon.ru',
];

var internetState = {
	stateUnknown : 0,
	stateNoInternet : 1,
	stateSomeInternetAvailable : 2,
	stateInternetWorks : 3,
}

var confirmedState = internetState.stateUnknown;
var pendingState = null;
var pendingCount = 0;
var lastNotificationTime = {};

const CONFIRMATIONS_NEEDED = 2;
const CHECK_INTERVAL = 15000; // 15 сек между проверками
const MIN_NOTIFICATION_INTERVAL = 5 * 60 * 1000;

var usersToNotify = [
	-1001070050013, //main chat
	1237321936, //avelacom support
];

// Проверяет доступность интернета у хостера (где запущен бот).
// Пингует несколько популярных РФ ресурсов. Если большинство недоступно —
// значит проблема на стороне хостера, а не у Avelacom.
// Вызывается только при обнаружении проблемы с Avelacom, чтобы отфильтровать
// ложные срабатывания из-за проблем с каналом у хостера.
function checkHostingInternet(callback) {
	var processed = 0;
	var alive = 0;

	internetCheckHosts.forEach(function(host) {
		ping.sys.probe(host, function(isAlive) {
			if (isAlive) alive++;
			if (++processed >= internetCheckHosts.length) {
				var hasInternet = (alive / processed) >= 0.5;
				console.log('[hosting] ' + alive + '/' + processed + ' reachable');
				callback(hasInternet);
			}
		}, { timeout: 5 });
	});
}

// Проверяет доступность IP-адресов оборудования Avelacom в поселке.
// Пингует все хосты из списка и вычисляет процент доступных.
// Результат записывается в uptime.log для истории.
// Возвращает состояние: stateInternetWorks (>=40%), stateSomeInternetAvailable (>=20%), stateNoInternet (<20%).
function checkAvelacomHosts(callback) {
	var processed = 0;
	var alive = 0;
	var results = {};

	hosts.forEach(function(host) {
		ping.sys.probe(host, function(isAlive) {
			if (isAlive == null || isAlive == undefined) isAlive = false;
			results[host] = isAlive;
			if (isAlive) alive++;

			if (++processed >= hosts.length) {
				var summary = hosts.map(function(h) {
					return h + (results[h] ? ' 🟢' : ' 🔴');
				}).join('	');
				console.log('[avelacom] ' + summary);

				var timestamp = Date.now();
				var percentage = Math.round((alive / processed) * 100);

				fs.appendFile('uptime.log', timestamp + ',' + percentage + '\n', (err) => {
					if (err) console.log(err);
				});

				var state;
				if (percentage >= 40) {
					state = internetState.stateInternetWorks;
				} else if (percentage >= 20) {
					state = internetState.stateSomeInternetAvailable;
				} else {
					state = internetState.stateNoInternet;
				}

				callback(state);
			}
		}, { timeout: 10 });
	});
}

// Основной цикл мониторинга. Вызывается каждые CHECK_INTERVAL мс.
// Проверяет состояние Avelacom и сравнивает с подтверждённым состоянием.
// Для смены состояния требуется CONFIRMATIONS_NEEDED подтверждений подряд —
// это защищает от ложных срабатываний при кратковременных сбоях.
function pingpong() {
	checkAvelacomHosts(function(newState) {
		// Первый запуск - просто запоминаем состояние
		if (confirmedState === internetState.stateUnknown) {
			confirmedState = newState;
			console.log('[init] Initial state: ' + newState);
			return;
		}

		// Состояние не изменилось
		if (newState === confirmedState) {
			pendingState = null;
			pendingCount = 0;
			return;
		}

		// Состояние изменилось - считаем подтверждения
		if (newState === pendingState) {
			pendingCount++;
			console.log('[pending] ' + pendingCount + '/' + CONFIRMATIONS_NEEDED);
		} else {
			pendingState = newState;
			pendingCount = 1;
			console.log('[pending] New state detected: ' + newState + ' (1/' + CONFIRMATIONS_NEEDED + ')');
		}

		// Достаточно подтверждений?
		if (pendingCount >= CONFIRMATIONS_NEEDED) {
			confirmStateChange(newState);
		}
	});
}

// Вызывается когда состояние подтверждено (получено CONFIRMATIONS_NEEDED раз подряд).
// Перед отправкой уведомления о проблеме проверяет интернет у хостера,
// чтобы не слать ложные уведомления когда проблема на стороне хостера.
function confirmStateChange(newState) {
	if (newState === internetState.stateNoInternet) {
		checkHostingInternet(function(hostingOk) {
			if (hostingOk) {
				applyStateChange(newState, true);
			} else {
				console.log('[hosting] No internet, suppressing notification');
				applyStateChange(newState, false);
			}
		});
	} else {
		applyStateChange(newState, true);
	}
}

// Применяет смену состояния: обновляет confirmedState, сбрасывает pending-счётчики.
// shouldNotify=false когда у хостера нет интернета — состояние меняем,
// но уведомление не шлём (чтобы избежать бесконечного цикла верификации).
function applyStateChange(newState, shouldNotify) {
	var oldState = confirmedState;
	confirmedState = newState;
	pendingState = null;
	pendingCount = 0;

	console.log('[state] ' + oldState + ' -> ' + newState + (shouldNotify ? '' : ' (suppressed)'));

	if (shouldNotify) {
		notify(oldState, newState);
	}
}

// Отправляет уведомление в чат и саппорту Avelacom.
// Уведомляет только о крайних состояниях (работает / не работает), не о промежуточных.
// Cooldown для каждого типа уведомления отдельный — чтобы уведомление о восстановлении
// не блокировалось недавним уведомлением о проблеме.
function notify(oldState, newState) {
	if (oldState === internetState.stateUnknown || newState === internetState.stateUnknown) {
		return;
	}

	// Cooldown для каждого типа уведомления отдельно
	var now = Date.now();
	if (now - (lastNotificationTime[newState] || 0) < MIN_NOTIFICATION_INTERVAL) {
		console.log('[notify] Cooldown active for state ' + newState);
		return;
	}

	if (newState === internetState.stateInternetWorks || newState === internetState.stateNoInternet) {
		var text = stateToText(newState);
		if (text) {
			lastNotificationTime[newState] = now;
			usersToNotify.forEach(function(userId) {
				bot.sendMessage(userId, text, {parse_mode: "markdown"});
			});
		}
	}
}

// Преобразует числовое состояние в текст для отправки пользователю.
function stateToText(state) {
	switch (state) {
		case internetState.stateNoInternet:
			return "🔴 Провайдер Avelacom *не доступен* в поселке";
		case internetState.stateSomeInternetAvailable:
			return "⚪ Подключение к Avelacom *доступно не во всех домах*";
		case internetState.stateInternetWorks:
			return "🔵 Подключение к Avelacom *работает в штатном режиме*";
		default:
			return null;
	}
}

// Возвращает текст статуса для ответа на запрос пользователя.
// Если состояние ещё не определено — возвращает сообщение "попробуйте позже".
function getStatusText() {
	if (confirmedState === internetState.stateUnknown) {
		return "_Состояние провайдера неизвестно, попробуйте позже_";
	}
	return stateToText(confirmedState);
}

// Обработчик команды /avelaping и её алиасов.
// Отвечает только в личных сообщениях, чтобы не спамить в общем чате.
bot.onText(new RegExp('^(\/avelaping|авелаком|интернет|'+global.commands.avelacom+')$', 'i'), function (msg, match) {
	if (msg.chat.type != 'private') return;

	var reply = getStatusText();
	if (reply) {
		bot.sendMessage(msg.chat.id, reply, {parse_mode: "markdown"});
	}
});

setInterval(pingpong, CHECK_INTERVAL);
pingpong();
