import React, { useEffect, useMemo, useState } from 'react';
import { DateTime } from 'luxon';
import { CANADIAN_PROVINCES, estimateTotal, fetchAvailability, createBooking, updateBooking } from '../lib/api';

type Mode = 'book' | 'update';

const BUSINESS_TZ = 'America/Toronto';
const BASE_FEE = 50;

type Suggestion = {
	label: string;
	lat: number;
	lon: number;
	address?: {
		house_number?: string;
		road?: string;
		city?: string;
		state?: string;
		postcode?: string;
		country?: string;
	};
};

export function BookingForm({ onConfirmed }: { onConfirmed: (data: any) => void }) {
	const [mode, setMode] = useState<Mode>('book');
	const [date, setDate] = useState<string>(DateTime.now().setZone(BUSINESS_TZ).toISODate() || '');
	const [slots, setSlots] = useState<string[]>([]);
	const [selectedSlot, setSelectedSlot] = useState<string>('');
	const [loadingSlots, setLoadingSlots] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Contact
	const [name, setName] = useState('');
	const [email, setEmail] = useState('');
	const [phone, setPhone] = useState('');

	// Address
	const [province, setProvince] = useState('Ontario');
	const [street, setStreet] = useState('');
	const [unit, setUnit] = useState('');
	const [city, setCity] = useState('');
	const [postal, setPostal] = useState('');
	const [country, setCountry] = useState('Canada');
	const [query, setQuery] = useState('');
	const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
	const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
	const [notes, setNotes] = useState('');

	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		let ignore = false;
		async function load() {
			setLoadingSlots(true);
			try {
				const res = await fetchAvailability(date);
				if (!ignore) setSlots(res.slots);
			} catch (e: any) {
				if (!ignore) setError(e.message || 'Failed to load availability');
			} finally {
				if (!ignore) setLoadingSlots(false);
			}
		}
		load();
		return () => { ignore = true; };
	}, [date]);

	useEffect(() => {
		if (query.length < 3) {
			setSuggestions([]);
			return;
		}
		const controller = new AbortController();
		const t = setTimeout(async () => {
			try {
				const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=1&countrycodes=ca&q=${encodeURIComponent(query)}`;
				const res = await fetch(url, { headers: { 'Accept-Language': 'en-CA' }, signal: controller.signal });
				if (res.ok) {
					const data = await res.json();
					const mapped: Suggestion[] = data.map((d: any) => ({
						label: d.display_name,
						lat: parseFloat(d.lat),
						lon: parseFloat(d.lon),
						address: d.address
					}));
					setSuggestions(mapped);
				}
			} catch {
				// ignore
			}
		}, 300);
		return () => { clearTimeout(t); controller.abort(); };
	}, [query]);

	useEffect(() => {
		if (selectedSuggestion?.address) {
			const a = selectedSuggestion.address;
			setStreet([a.house_number, a.road].filter(Boolean).join(' '));
			setCity(a.city || '');
			setProvince(a.state || 'Ontario');
			setPostal(a.postcode || '');
		}
	}, [selectedSuggestion]);

	const urgentFee = useMemo(() => {
		if (!selectedSlot) return 0;
		const start = DateTime.fromISO(selectedSlot, { zone: BUSINESS_TZ });
		const diff = start.diffNow().as('hours');
		return diff < 6 ?  Number(import.meta.env.VITE_URGENT_FEE ?? 20) : 0;
	}, [selectedSlot]);

	const quote = useMemo(() => estimateTotal(BASE_FEE, province, urgentFee), [province, urgentFee]);

	const canSubmit = useMemo(() => {
		if (mode === 'update') {
			return phone.trim().length >= 8 && selectedSlot;
		}
		return Boolean(selectedSlot && name && email && phone && street && city && postal && province);
	}, [mode, selectedSlot, name, email, phone, street, city, postal, province]);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!canSubmit) return;
		setSubmitting(true);
		setError(null);
		try {
			if (mode === 'update') {
				const res = await updateBooking({ phone, newStartIso: selectedSlot });
				onConfirmed({
					summary: res.summary,
					startIso: res.startIso,
					endIso: res.endIso,
					total: res.total,
					currency: res.currency,
					icsData: res.ics,
					googleAddUrl: res.googleAddUrl,
					reference: res.reference
				});
			} else {
				const res = await createBooking({
					startIso: selectedSlot,
					contact: { name, email, phone },
					location: {
						street, unit, city, postalCode: postal, province, country,
						formatted: selectedSuggestion?.label,
						coordinates: selectedSuggestion ? { lat: selectedSuggestion.lat, lon: selectedSuggestion.lon } : undefined
					},
					notes
				});
				onConfirmed({
					summary: res.summary,
					startIso: res.startIso,
					endIso: res.endIso,
					total: res.total,
					currency: res.currency,
					icsData: res.ics,
					googleAddUrl: res.googleAddUrl,
					reference: res.reference
				});
			}
		} catch (err: any) {
			setError(err.message || 'Something went wrong');
		} finally {
			setSubmitting(false);
		}
	}

	const todayIso = DateTime.now().setZone(BUSINESS_TZ).toISODate();

	return (
		<section id="book" className="card">
			<div className="section-title">
				<h2>Book your clean</h2>
				<div className="chips" role="tablist" aria-label="Mode">
					<button className={`chip ${mode === 'book' ? 'selected' : ''}`} onClick={() => setMode('book')}>New booking</button>
					<button className={`chip ${mode === 'update' ? 'selected' : ''}`} onClick={() => setMode('update')}>Update existing</button>
				</div>
			</div>

			<form onSubmit={onSubmit} className="grid">
				<div className="row">
					<div className="col-6">
						<label htmlFor="date">Choose date</label>
						<input id="date" type="date" value={date} min={todayIso || undefined} onChange={e => setDate(e.target.value)} />
					</div>
				</div>

				<div className="divider" />

				<div>
					<label>Available times (Eastern Time)</label>
					<div className="chips" aria-live="polite">
						{loadingSlots && <span>LoadingÅc</span>}
						{!loadingSlots && slots.length === 0 && <span>No availability for this date.</span>}
						{slots.map(s => {
							const dt = DateTime.fromISO(s).setZone(BUSINESS_TZ);
							return (
								<button
									type="button"
									key={s}
									className={`slot ${selectedSlot === s ? 'selected' : ''}`}
									onClick={() => setSelectedSlot(s)}
								>
									{dt.toLocaleString(DateTime.TIME_SIMPLE)}
								</button>
							);
						})}
					</div>
				</div>

				{mode === 'book' && (
					<>
						<div className="divider" />
						<div className="row">
							<div className="col-6">
								<label htmlFor="name">Full name</label>
								<input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Jane Doe" />
							</div>
							<div className="col-6">
								<label htmlFor="email">Email</label>
								<input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" />
							</div>
						</div>
						<div className="row">
							<div className="col-6">
								<label htmlFor="phone">Phone</label>
								<input id="phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(416) 555?1234" />
							</div>
							<div className="col-6">
								<label htmlFor="province">Province</label>
								<select id="province" value={province} onChange={e => setProvince(e.target.value)}>
									{CANADIAN_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
								</select>
							</div>
						</div>

						<label>Search address (Canada)</label>
						<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Start typing your addressÅc" />
						{suggestions.length > 0 && (
							<ul className="list card" style={{ marginTop: 8 }}>
								{suggestions.map((s, i) => (
									<li key={i}>
										<button type="button" className="btn ghost" onClick={() => { setSelectedSuggestion(s); setQuery(s.label); setSuggestions([]); }}>
											{s.label}
										</button>
									</li>
								))}
							</ul>
						)}

						<div className="row" style={{ marginTop: 8 }}>
							<div className="col-6">
								<label htmlFor="street">Street</label>
								<input id="street" value={street} onChange={e => setStreet(e.target.value)} placeholder="123 Main St" />
							</div>
							<div className="col-6">
								<label htmlFor="unit">Apt/Unit (optional)</label>
								<input id="unit" value={unit} onChange={e => setUnit(e.target.value)} placeholder="Unit 5" />
							</div>
						</div>
						<div className="row">
							<div className="col-4">
								<label htmlFor="city">City</label>
								<input id="city" value={city} onChange={e => setCity(e.target.value)} placeholder="Toronto" />
							</div>
							<div className="col-4">
								<label htmlFor="postal">Postal code</label>
								<input id="postal" value={postal} onChange={e => setPostal(e.target.value)} placeholder="M5V 2T6" />
							</div>
							<div className="col-4">
								<label htmlFor="country">Country</label>
								<select id="country" value={country} onChange={e => setCountry(e.target.value)}>
									<option>Canada</option>
								</select>
							</div>
						</div>

						<label htmlFor="notes">Notes (optional)</label>
						<textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Parking or building notesÅc" />
					</>
				)}

				<div className="divider" />
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
					<div>
						<div className="price">
							{mode === 'book'
								? `Estimated total: ${new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(quote.total)}`
								: 'Reschedule free if 2+ hours before'}
						</div>
						{mode === 'book' && (
							<div className="muted">
								Base ${BASE_FEE} + tax ({quote.taxLabel})
								{urgentFee ? ` + urgent fee $${urgentFee}` : ''}
							</div>
						)}
					</div>
					<button className="btn primary" type="submit" disabled={!canSubmit || submitting}>
						{mode === 'book' ? 'Confirm booking' : 'Update appointment'}
					</button>
				</div>

				{error && <div className="card" style={{ borderColor: '#fde68a', background: '#fffbeb' }}>{error}</div>}
			</form>
		</section>
	);
}


