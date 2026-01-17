## Cabin Clean ? On?Demand Interior Detailing (Canada)

Vite + React single?page app with Netlify Functions backing a Google Calendar integration for scheduling. One?hour sessions, 30?minute buffer between bookings, 8am?10pm ET operating window, 6?hour advance notice (or configurable urgent fee), province?aware taxes, address lookup via OpenStreetMap Nominatim, and self?service rescheduling (2+ hours before).

### Tech
- Frontend: Vite + React + TypeScript
- Serverless: Netlify Functions (Node 18+)
- Calendar: Google Calendar API (Service Account)

### Environment variables
Create these in your Netlify site settings (or a local `.env` file when running `netlify dev`):

- `GOOGLE_CALENDAR_ID` ? ID of the target calendar
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` ? service account email
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` ? private key with `\n` newlines escaped
- `BUSINESS_TIMEZONE` ? default `America/Toronto`
- `SLOT_DURATION_MINUTES` ? default `60`
- `BUFFER_MINUTES` ? default `30`
- `MIN_NOTICE_HOURS` ? default `6`
- `MIN_UPDATE_NOTICE_HOURS` ? default `2`
- `BASE_FEE_CAD` ? default `50`
- `URGENT_FEE_CAD` ? default `20`
- `VITE_URGENT_FEE` ? mirror of urgent fee for UI hints

### Google setup (Service Account)
1. In Google Cloud Console, create a project and enable the Calendar API.
2. Create a Service Account and download its key. Store email and private key in Netlify env.
3. In Google Calendar (web), share the target calendar with the service account email and give ÅgMake changes to eventsÅh permission.

### Run locally
```bash
npm i
npm run dev
```
Deploy to Netlify; functions live in `netlify/functions`.

### Endpoints
- `/.netlify/functions/availability?date=YYYY-MM-DD`
- `/.netlify/functions/book` (POST)
- `/.netlify/functions/update` (POST)

All prices are computed server?side; the UI shows an estimate. The calendar event stores `phone`, `email`, and `reference` in private extended properties for conflict checks and updates.


