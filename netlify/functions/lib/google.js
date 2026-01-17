import { google } from 'googleapis';

function getEnv(name, fallback) {
	const v = process.env[name];
	if (!v && typeof fallback !== 'undefined') return fallback;
	return v;
}

export function getBusinessTimezone() {
	return getEnv('BUSINESS_TIMEZONE', 'America/Toronto');
}

export function getConfig() {
	return {
		calendarId: getEnv('GOOGLE_CALENDAR_ID'),
		serviceAccountEmail: getEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
		privateKey: (getEnv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY') || '').replace(/\\n/g, '\n'),
		slotMinutes: Number(getEnv('SLOT_DURATION_MINUTES') || 60),
		bufferMinutes: Number(getEnv('BUFFER_MINUTES') || 30),
		minNoticeHours: Number(getEnv('MIN_NOTICE_HOURS') || 6),
		minUpdateNoticeHours: Number(getEnv('MIN_UPDATE_NOTICE_HOURS') || 2),
		baseFee: Number(getEnv('BASE_FEE_CAD') || 50),
		urgentFee: Number(getEnv('URGENT_FEE_CAD') || 20)
	};
}

export function getCalendarClient() {
	const { serviceAccountEmail, privateKey } = getConfig();
	if (!serviceAccountEmail || !privateKey) {
		throw new Error('Missing Google service account credentials');
	}
	const jwt = new google.auth.JWT(
		serviceAccountEmail,
		undefined,
		privateKey,
		['https://www.googleapis.com/auth/calendar']
	);
	return google.calendar({ version: 'v3', auth: jwt });
}

export function responseJson(statusCode, body) {
	return {
		statusCode,
		headers: {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': '*'
		},
		body: JSON.stringify(body)
	};
}

export function makeReference() {
	const n = Math.floor(100000 + Math.random() * 900000);
	return `CC-${n}`;
}

export function generateICS(summary, description, location, startIso, endIso, timezone) {
	// Create a very small ICS file
	const dtStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
	const format = (iso) => {
		// convert to UTC zulu basic format
		const d = new Date(iso);
		return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
	};
	const uid = `${Math.random().toString(36).slice(2)}@cabinclean`;
	return [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//Cabin Clean//Booking//EN',
		'BEGIN:VEVENT',
		`UID:${uid}`,
		`DTSTAMP:${dtStamp}`,
		`DTSTART:${format(startIso)}`,
		`DTEND:${format(endIso)}`,
		`SUMMARY:${escapeText(summary)}`,
		`DESCRIPTION:${escapeText(description)}`,
		`LOCATION:${escapeText(location || '')}`,
		'END:VEVENT',
		'END:VCALENDAR'
	].join('\r\n');
}

function escapeText(text) {
	return String(text || '')
		.replace(/\\/g, '\\\\')
		.replace(/\n/g, '\\n')
		.replace(/,/g, '\\,')
		.replace(/;/g, '\\;');
}


