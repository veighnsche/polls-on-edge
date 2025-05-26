import type { FC } from 'hono/jsx';

export const Layout: FC = props => (
	<html>
		<head>
			<meta charSet="utf-8" />
			<meta name="viewport" content="width=device-width, initial-scale=1" />
			<title>Polls on Edge – Real-Time Polls with Edge Rendering</title>
			<meta
				name="description"
				content="Create, share, and participate in real-time polls instantly. Polls on Edge leverages edge rendering for lightning-fast, scalable polling experiences. No sign-up required – just create, vote, and share."
			/>
			<meta
				name="keywords"
				content="polls, real-time polls, edge rendering, instant polls, voting, create poll, online poll, scalable polls, fast polling, poll app"
			/>

			{/* Open Graph / Facebook */}
			<meta property="og:title" content="Polls on Edge – Real-Time Polls with Edge Rendering" />
			<meta
				property="og:description"
				content="Create, share, and participate in real-time polls instantly. Lightning-fast, scalable polling for everyone."
			/>
			<meta property="og:type" content="website" />
			<meta property="og:url" content="https://edgypolls.com/" />
			<meta property="og:image" content="https://edgypolls.com/og-image.png" />

			{/* Twitter Card */}
			<meta name="twitter:card" content="summary_large_image" />
			<meta name="twitter:title" content="Polls on Edge – Real-Time Polls with Edge Rendering" />
			<meta
				name="twitter:description"
				content="Create, share, and participate in real-time polls instantly. Lightning-fast, scalable polling for everyone."
			/>
			<meta name="twitter:image" content="https://edgypolls.com/og-image.png" />

			{/* JSON-LD Structured Data */}
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{
					__html: `{
					  "@context": "https://schema.org",
					  "@type": "WebSite",
					  "name": "Polls on Edge",
					  "url": "https://edgypolls.com/",
					  "description": "Create, share, and participate in real-time polls instantly. Polls on Edge leverages edge rendering for lightning-fast, scalable polling experiences.",
					  "potentialAction": {
					    "@type": "SearchAction",
					    "target": "https://edgypolls.com/?q={search_term_string}",
					    "query-input": "required name=search_term_string"
					  }
					}
				}`,
				}}
			/>
			<link rel="stylesheet" href="/dist/styles.css" />
		</head>
		<body>
			<header className="py-6 shadow-md mb-8 bg-primary">
				<h1 className="text-3xl font-bold text-center tracking-wide text-primary-foreground">
					<a href="/">Polls on Edge</a>
				</h1>
			</header>
			<main className="max-w-xl mx-auto px-4">{props.children}</main>
		</body>
	</html>
);
