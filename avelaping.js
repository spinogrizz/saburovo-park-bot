// Состояние провайдера Avelacom считает бэкенд приложения Сабурово Парк (saburovo-park-backend):
// он пингует оборудование в посёлке (адреса — в админке), ведёт журнал сбоев и решает,
// когда есть повод написать в чат. Бот забирает эти поводы long polling'ом
// (/internal/provider/notices) и пишет сообщения — тексты только здесь.
// Бэкенд доступен по docker-сети shared; ключ — тот же INTERNAL_TOKEN, что у бэкенда.

var BACKEND_URL = process.env.BACKEND_URL || 'http://saburovo-park-backend:3000';
var BACKEND_TOKEN = process.env.BACKEND_TOKEN;

// До какого сообщения дошли — в redis, чтобы после перезапуска не повторять и не терять.
var CURSOR_KEY = 'avelacom:notice';
// Бот лежал дольше — старые новости в чат уже не шлём.
var MAX_NOTICE_AGE = 15 * 60 * 1000;
var RETRY_DELAY = 15000;

var usersToNotify = [
	-1001070050013, //main chat
	1237321936, //avelacom support
];

function backend(path) {
	return fetch(BACKEND_URL + '/internal/provider' + path, {
		headers: { Authorization: 'Bearer ' + BACKEND_TOKEN },
		signal: AbortSignal.timeout(40000),
	}).then(function(res) {
		if (!res.ok) throw new Error('backend ' + res.status);
		return res.json();
	});
}

function redisGet(key) {
	return new Promise(function(resolve, reject) {
		redis.get(key, function(err, value) { err ? reject(err) : resolve(value); });
	});
}

function redisSet(key, value) {
	return new Promise(function(resolve, reject) {
		redis.set(key, String(value), function(err) { err ? reject(err) : resolve(); });
	});
}

// «25 мин», «2 ч 5 мин», «3 дн 4 ч».
function duration(ms) {
	var minutes = Math.max(1, Math.round(ms / 60000));
	var d = Math.floor(minutes / 1440);
	var h = Math.floor((minutes % 1440) / 60);
	var m = minutes % 60;
	if (d) return [d + ' дн', h && h + ' ч'].filter(Boolean).join(' ');
	return [h && h + ' ч', m && m + ' мин'].filter(Boolean).join(' ');
}

// Сообщение в чат: «не работает» или «снова работает» (since — когда начался закончившийся сбой).
function noticeText(notice) {
	if (notice.state === 'down') {
		return "🔴 Провайдер Avelacom *не доступен* в поселке";
	}
	var text = "🔵 Подключение к Avelacom *работает в штатном режиме*";
	if (notice.since) {
		text += "\n_Перерыв длился " + duration(new Date(notice.at) - new Date(notice.since)) + "_";
	}
	return text;
}

// Ответ на «📡 Авелаком»: текущее состояние.
function statusText(status) {
	switch (status.state) {
		case 'up':
			return "🔵 Подключение к Avelacom *работает в штатном режиме*";
		case 'partial':
			return "⚪ Подключение к Avelacom *доступно не во всех домах*";
		case 'down':
			var text = "🔴 Провайдер Avelacom *не доступен* в поселке";
			if (status.since) text += "\n_Не работает уже " + duration(Date.now() - new Date(status.since)) + "_";
			return text;
		default:
			return "_Состояние провайдера неизвестно, попробуйте позже_";
	}
}

function sleep(ms) {
	return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

// Бесконечный цикл: ждём новых поводов (бэкенд держит запрос до 25 с) и рассылаем их.
async function watchNotices() {
	var cursor = null;
	while (true) {
		try {
			if (cursor === null) {
				// Последний id у бэкенда: с него начинаем, если своего курсора нет
				// или он «из будущего» (база бэкенда моложе курсора).
				var head = await backend('/notices');
				var saved = Number(await redisGet(CURSOR_KEY));
				cursor = saved && saved <= head.last ? saved : head.last;
				await redisSet(CURSOR_KEY, cursor);
				console.log('[avelacom] notices from #' + cursor);
			}
			var result = await backend('/notices?after=' + cursor + '&wait=25');
			result.notices.forEach(function(notice) {
				if (Date.now() - new Date(notice.at) > MAX_NOTICE_AGE) {
					console.log('[avelacom] skip stale notice #' + notice.id);
					return;
				}
				console.log('[avelacom] notice #' + notice.id + ': ' + notice.state);
				var text = noticeText(notice);
				usersToNotify.forEach(function(userId) {
					bot.sendMessage(userId, text, {parse_mode: "markdown"});
				});
			});
			if (result.last !== cursor) {
				cursor = result.last;
				await redisSet(CURSOR_KEY, cursor);
			}
		} catch (err) {
			console.log('[avelacom] ' + err.message);
			await sleep(RETRY_DELAY);
		}
	}
}

// Обработчик команды /avelaping и её алиасов.
// Отвечает только в личных сообщениях, чтобы не спамить в общем чате.
bot.onText(new RegExp('^(\/avelaping|авелаком|интернет|'+global.commands.avelacom+')$', 'i'), function (msg, match) {
	if (msg.chat.type != 'private') return;

	backend('').then(statusText, function(err) {
		console.log('[avelacom] ' + err.message);
		return "_Не удалось узнать состояние провайдера, попробуйте позже_";
	}).then(function(reply) {
		bot.sendMessage(msg.chat.id, reply, {parse_mode: "markdown"});
	});
});

if (BACKEND_TOKEN) {
	watchNotices();
} else {
	console.log('[avelacom] BACKEND_TOKEN не задан — оповещения о провайдере выключены');
}
