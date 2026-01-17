import React, { useMemo, useState } from 'react';
import { DateTime } from 'luxon';
import { BookingForm } from './components/BookingForm';
import { Hero } from './components/Hero';
import { Footer } from './components/Footer';

export function App() {
	const [confirmed, setConfirmed] = useState<null | {
		summary: string;
		startIso: string;
		endIso: string;
		total: number;
		currency: string;
		icsData?: string;
		googleAddUrl?: string;
		reference?: string;
	}> (null);

	const year = useMemo(() => DateTime.now().setZone('America/Toronto').year, []);

	return (
		<div className="site">
			<Hero />
			<main className="container">
				<BookingForm onConfirmed={setConfirmed} />
				{confirmed && (
					<section className="card success">
						<h3>Booking confirmed</h3>
						<p>{confirmed.summary}</p>
						<p>
							<strong>When:</strong>{' '}
							{DateTime.fromISO(confirmed.startIso).setZone('America/Toronto').toLocaleString(DateTime.DATETIME_MED)}{' '}
							? {DateTime.fromISO(confirmed.endIso).setZone('America/Toronto').toLocaleString(DateTime.TIME_SIMPLE)} ET
						</p>
						<p>
							<strong>Total:</strong> {new Intl.NumberFormat('en-CA', { style: 'currency', currency: confirmed.currency }).format(confirmed.total)}
						</p>
						<div className="actions">
							{confirmed.googleAddUrl && (
								<a className="btn primary" href={confirmed.googleAddUrl} target="_blank" rel="noreferrer">Add to Google Calendar</a>
							)}
							{confirmed.icsData && (
								<a
									className="btn"
									href={`data:text/calendar;charset=utf-8,${encodeURIComponent(confirmed.icsData)}`}
									download="CabinClean.ics"
								>
									Download ICS
								</a>
							)}
						</div>
						{confirmed.reference && (
							<p className="muted">Reference: {confirmed.reference}</p>
						)}
					</section>
				)}
			</main>
			<Footer year={year} />
		</div>
	);
}


