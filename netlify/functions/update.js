import { DateTime, Interval } from 'luxon';
import { getBusinessTimezone, getCalendarClient, getConfig, generateICS, responseJson } from './lib/google.js';

export async function handler(event) {
	if (event.httpMethod !== 'POST') {
		return responseJson(405, { error: 'Method not allowed' });
	}
	try {
		const tz = getBusinessTimezone();
		const cfg = getConfig();
		const { phone, newStartIso } = JSON.parse(event.body || '{}');
		if (!phone || !newStartIso) return responseJson(400, { error: 'Phone and newStartIso required' });

		const calendar = getCalendarClient();
		// Find next upcoming event by phone via private extended property
		const list = await calendar.events.list({
			calendarId: cfg.calendarId,
			maxResults: 5,
			singleEvents: true,
			orderBy: 'startTime',
			timeMin: DateTime.now().toUTC().toISO(),
			privateExtendedProperty: `phone=${phone}`
		});
		const event = (list.data.items || [])[0];
		if (!event) return responseJson(404, { error: 'No upcoming appointment found for this phone' });

		const currentStart = DateTime.fromISO(event.start?.dateTime || event.start?.date, { zone: tz });
		if (currentStart.diffNow().as('hours') < cfg.minUpdateNoticeHours) {
			return responseJson(400, { error: 'Updates allowed only if 2+ hours before appointment' });
		}

		const newStart = DateTime.fromISO(newStartIso, { zone: tz });
		const newEnd = newStart.plus({ minutes: cfg.slotMinutes });
		// Check service hours
		const serviceStart = newStart.startOf('day').plus({ hours: 8 });
		const serviceEnd = newStart.startOf('day').plus({ hours: 22 });
		if (!(newStart >= serviceStart && newEnd <= serviceEnd)) {
			return responseJson(400, { error: 'Outside service hours (8am?10pm ET)' });
		}

		// conflict check
		const fb = await calendar.freebusy.query({
			requestBody: {
				timeMin: newStart.minus({ minutes: cfg.bufferMinutes }).toUTC().toISO(),
				timeMax: newEnd.plus({ minutes: cfg.bufferMinutes }).toUTC().toISO(),
				items: [{ id: cfg.calendarId }]
			}
		});
		const busy = (fb.data.calendars?.[cfg.calendarId]?.busy || []).map(b => ({
			start: DateTime.fromISO(b.start),
			end: DateTime.fromISO(b.end)
		}));
		const hasOverlap = busy.some(b => Interval.fromDateTimes(b.start.minus({ minutes: cfg.bufferMinutes }), b.end.plus({ minutes: cfg.bufferMinutes })).overlaps(Interval.fromDateTimes(newStart, newEnd)));
		if (hasOverlap) return responseJson(409, { error: 'Selected time no longer available' });

		// Update event
		const updated = await calendar.events.patch({
			calendarId: cfg.calendarId,
			eventId: event.id,
			requestBody: {
				start: { dateTime: newStart.toISO(), timeZone: tz },
				end: { dateTime: newEnd.toISO(), timeZone: tz }
			}
		});

		const summary = updated.data.summary || 'Cabin Clean ? Interior Detailing';
		const description = updated.data.description || '';
		const location = updated.data.location || '';
		const ics = generateICS(summary, description, location, newStart.toISO(), newEnd.toISO(), tz);
		return responseJson(200, {
			ok: true,
			reference: updated.data.extendedProperties?.private?.reference || '',
			eventId: updated.data.id,
			startIso: newStart.toISO(),
			endIso: newEnd.toISO(),
			summary,
			total: 0,
			currency: 'CAD',
			ics
		});
	} catch (err) {
		console.error(err);
		return responseJson(500, { error: 'Update failed' });
	}
}


