import { DateTime, Interval } from 'luxon';
import { getBusinessTimezone, getCalendarClient, getConfig, generateICS, makeReference, responseJson } from './lib/google.js';

const TAX_RATES = {
	'Alberta': 0.05,
	'British Columbia': 0.12,
	'Manitoba': 0.12,
	'New Brunswick': 0.15,
	'Newfoundland and Labrador': 0.15,
	'Northwest Territories': 0.05,
	'Nova Scotia': 0.15,
	'Nunavut': 0.05,
	'Ontario': 0.13,
	'Prince Edward Island': 0.15,
	'Quebec': 0.14975,
	'Saskatchewan': 0.11,
	'Yukon': 0.05
};

export async function handler(event) {
	if (event.httpMethod !== 'POST') {
		return responseJson(405, { error: 'Method not allowed' });
	}
	try {
		const tz = getBusinessTimezone();
		const cfg = getConfig();
		const body = JSON.parse(event.body || '{}');
		const { startIso, contact, location, notes } = body;
		if (!startIso || !contact?.email || !contact?.phone || !contact?.name || !location?.street || !location?.city || !location?.postalCode || !location?.province) {
			return responseJson(400, { error: 'Missing required fields' });
		}
		const start = DateTime.fromISO(startIso, { zone: tz });
		const end = start.plus({ minutes: cfg.slotMinutes });

		// validate hours (8am-10pm service window)
		const serviceStart = start.startOf('day').plus({ hours: 8 });
		const serviceEnd = start.startOf('day').plus({ hours: 22 });
		if (!(start >= serviceStart && end <= serviceEnd)) {
			return responseJson(400, { error: 'Outside service hours (8am?10pm ET)' });
		}

		// conflict check against buffered busy
		const calendar = getCalendarClient();
		const buffer = cfg.bufferMinutes;
		const fb = await calendar.freebusy.query({
			requestBody: {
				timeMin: start.minus({ minutes: buffer }).toUTC().toISO(),
				timeMax: end.plus({ minutes: buffer }).toUTC().toISO(),
				items: [{ id: cfg.calendarId }]
			}
		});
		const busy = (fb.data.calendars?.[cfg.calendarId]?.busy || []).map(b => ({
			start: DateTime.fromISO(b.start),
			end: DateTime.fromISO(b.end)
		}));
		const hasOverlap = busy.some(b => Interval.fromDateTimes(b.start.minus({ minutes: buffer }), b.end.plus({ minutes: buffer })).overlaps(Interval.fromDateTimes(start, end)));
		if (hasOverlap) {
			return responseJson(409, { error: 'Time no longer available' });
		}

		// pricing
		const base = cfg.baseFee;
		const urgentFee = start.diffNow().as('hours') < cfg.minNoticeHours ? cfg.urgentFee : 0;
		const rate = TAX_RATES[location.province] ?? 0.13;
		const subtotal = base + urgentFee;
		const tax = Math.round((subtotal * rate + Number.EPSILON) * 100) / 100;
		const total = Math.round((subtotal + tax + Number.EPSILON) * 100) / 100;

		const reference = makeReference();
		const address = `${location.street}${location.unit ? ', ' + location.unit : ''}, ${location.city}, ${location.province} ${location.postalCode}, ${location.country || 'Canada'}`;
		const summary = 'Cabin Clean ? Interior Detailing';
		const description = [
			`Name: ${contact.name}`,
			`Phone: ${contact.phone}`,
			`Email: ${contact.email}`,
			`Address: ${address}`,
			location.formatted ? `Map: ${location.formatted}` : '',
			location.coordinates ? `Coords: ${location.coordinates.lat},${location.coordinates.lon}` : '',
			notes ? `Notes: ${notes}` : '',
			'',
			`Pricing (CAD): Base $${base}${urgentFee ? ` + Urgent $${urgentFee}` : ''} + Tax = Total $${total}`,
			`Reference: ${reference}`
		].filter(Boolean).join('\n');

		// create event
		const res = await calendar.events.insert({
			calendarId: cfg.calendarId,
			requestBody: {
				summary,
				description,
				location: address,
				start: { dateTime: start.toISO(), timeZone: tz },
				end: { dateTime: end.toISO(), timeZone: tz },
				extendedProperties: {
					private: {
						phone: contact.phone,
						email: contact.email,
						reference,
						province: location.province,
						postalCode: location.postalCode
					}
				}
			}
		});
		const event = res.data;
		const ics = generateICS(summary, description, address, start.toISO(), end.toISO(), tz);
		const googleAddUrl = buildGoogleAddUrl(summary, description, address, start, end, tz);
		return responseJson(200, {
			ok: true,
			reference,
			eventId: event.id,
			startIso: start.toISO(),
			endIso: end.toISO(),
			summary,
			total,
			currency: 'CAD',
			ics,
			googleAddUrl,
			urgentApplied: urgentFee > 0
		});
	} catch (err) {
		console.error(err);
		return responseJson(500, { error: 'Booking failed' });
	}
}

function buildGoogleAddUrl(summary, description, location, start, end, tz) {
	const fmt = (dt) => dt.toUTC().toFormat("yyyyLLdd'T'HHmmss'Z'");
	const params = new URLSearchParams({
		action: 'TEMPLATE',
		text: summary,
		dates: `${fmt(start)}/${fmt(end)}`,
		details: description,
		location,
		ctz: tz
	});
	return `https://calendar.google.com/calendar/render?${params.toString()}`;
}


