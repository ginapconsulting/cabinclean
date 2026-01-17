export type AvailabilityResponse = {
	slots: string[]; // ISO start times
	timezone: string;
};

export type BookingPayload = {
	startIso: string;
	contact: { name: string; email: string; phone: string };
	location: {
		street: string;
		unit?: string;
		city: string;
		postalCode: string;
		province: string;
		country: string;
		formatted?: string;
		coordinates?: { lat: number; lon: number };
	};
	notes?: string;
};

export type BookingResponse = {
	ok: boolean;
	reference: string;
	eventId: string;
	startIso: string;
	endIso: string;
	summary: string;
	total: number;
	currency: string;
	ics?: string;
	googleAddUrl?: string;
	urgentApplied?: boolean;
};

export type UpdatePayload = {
	phone: string;
	newStartIso: string;
};

export async function fetchAvailability(dateISO: string): Promise<AvailabilityResponse> {
	const url = `/.netlify/functions/availability?date=${encodeURIComponent(dateISO)}`;
	const res = await fetch(url);
	if (!res.ok) throw new Error('Failed to fetch availability');
	return res.json();
}

export async function createBooking(payload: BookingPayload): Promise<BookingResponse> {
	const res = await fetch('/.netlify/functions/book', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});
	if (!res.ok) throw new Error(await res.text());
	return res.json();
}

export async function updateBooking(payload: UpdatePayload): Promise<BookingResponse> {
	const res = await fetch('/.netlify/functions/update', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});
	if (!res.ok) throw new Error(await res.text());
	return res.json();
}

export const CANADIAN_PROVINCES = [
	'Alberta','British Columbia','Manitoba','New Brunswick','Newfoundland and Labrador','Northwest Territories','Nova Scotia','Nunavut','Ontario','Prince Edward Island','Quebec','Saskatchewan','Yukon'
];

export const PROVINCE_TAX_RATES: Record<string, { label: string; rate: number }> = {
	'Alberta': { label: 'GST', rate: 0.05 },
	'British Columbia': { label: 'GST+PST', rate: 0.12 },
	'Manitoba': { label: 'GST+PST', rate: 0.12 },
	'New Brunswick': { label: 'HST', rate: 0.15 },
	'Newfoundland and Labrador': { label: 'HST', rate: 0.15 },
	'Northwest Territories': { label: 'GST', rate: 0.05 },
	'Nova Scotia': { label: 'HST', rate: 0.15 },
	'Nunavut': { label: 'GST', rate: 0.05 },
	'Ontario': { label: 'HST', rate: 0.13 },
	'Prince Edward Island': { label: 'HST', rate: 0.15 },
	'Quebec': { label: 'GST+QST', rate: 0.14975 },
	'Saskatchewan': { label: 'GST+PST', rate: 0.11 },
	'Yukon': { label: 'GST', rate: 0.05 }
};

export function estimateTotal(base: number, province: string, urgentFee = 0): { subtotal: number; taxLabel: string; taxAmount: number; total: number } {
	const rate = PROVINCE_TAX_RATES[province]?.rate ?? 0.13;
	const label = PROVINCE_TAX_RATES[province]?.label ?? 'HST';
	const subtotal = base + urgentFee;
	const taxAmount = Math.round((subtotal * rate + Number.EPSILON) * 100) / 100;
	return { subtotal, taxLabel: label, taxAmount, total: Math.round((subtotal + taxAmount + Number.EPSILON) * 100) / 100 };
}


