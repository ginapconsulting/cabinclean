import React from 'react';

export function Hero() {
	return (
		<header className="hero">
			<div className="container">
				<div className="flag"><span className="leaf" /> Proudly Canadian</div>
				<h1>Cabin Clean</h1>
				<p>Fresh inside, on?demand. Book a 1?hour interior clean anywhere in the GTA.</p>
				<div className="actions">
					<a className="btn primary" href="#book">Book now ? from $50</a>
					<a className="btn ghost" href="#details">See whatÅfs included</a>
				</div>
			</div>
		</header>
	);
}


