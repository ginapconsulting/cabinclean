import { DateTime, Interval } from 'luxon';
import { getCalendarClient, getConfig, getBusinessTimezone, responseJson } from './lib/google.js';

export async function handler(event) {
	try {
		const tz = getBusinessTimezone();
		const { bufferMinutes, slotMinutes } = getConfig();
		const dateParam = (event.queryStringParameters && event.queryStringParameters.date) || DateTime.now().setZone(tz).toISODate();
		const dayStart = DateTime.fromISO(dateParam, { zone: tz }).startOf('day').plus({ hours: 8 });
		const dayEnd = DateTime.fromISO(dateParam, { zone: tz }).startOf('day').plus({ hours: 22 });

		// Fetch busy times
		const calendar = getCalendarClient();
		const freeBusy = await calendar.freebusy.query({
			requestBody: {
				timeMin: dayStart.toUTC().toISO(),
				timeMax: dayEnd.toUTC().toISO(),
				items: [{ id: getConfig().calendarId }]
			}
		});
		const busy = (freeBusy.data.calendars?.[getConfig().calendarId]?.busy || []).map(b => ({
			start: DateTime.fromISO(b.start),
			end: DateTime.fromISO(b.end)
		}));

		// Buffer busy periods on both sides
		const buffered = busy.map(b => ({
			start: b.start.minus({ minutes: bufferMinutes }),
			end: b.end.plus({ minutes: bufferMinutes })
		}));

		// Create candidate slots every 30 minutes between 8am and 9pm inclusive
		const stepMinutes = 30;
		let cursor = dayStart;
		const slots = [];
		while (cursor < dayEnd.minus({ minutes: slotMinutes })) {
			const start = cursor;
			const end = cursor.plus({ minutes: slotMinutes });
			const slotInterval = Interval.fromDateTimes(start, end);

			const overlaps = buffered.some(b => Interval.fromDateTimes(b.start, b.end).overlaps(slotInterval));
			if (!overlaps) {
				slots.push(start.toISO());
			}
			cursor = cursor.plus({ minutes: stepMinutes });
		}

		return responseJson(200, { slots, timezone: tz });
	} catch (err) {
		console.error(err);
		return responseJson(500, { error: 'Failed to compute availability' });
	}
}


