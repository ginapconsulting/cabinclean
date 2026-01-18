import React from 'react';

export function Footer({ year }: { year: number }) {
	return (
		<footer>
			<div className="container">
				<div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
					<div>- {year} Cabin Clean - Interior Detailing</div>
					<div>Toronto, Ontario - HST Registered</div>
				</div>
			</div>
		</footer>
	);
}


