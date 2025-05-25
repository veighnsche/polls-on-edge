import type { FC } from "hono/jsx";

export const Layout: FC = (props) => (
  <html>
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Polls on Edge</title>
      <link rel="stylesheet" href="/dist/styles.css" />
    </head>
    <body>
      <header className="py-6 shadow-md mb-8 bg-primary">
        <h1 className="text-3xl font-bold text-center tracking-wide text-primary-foreground">
          Polls on Edge
        </h1>
      </header>
      <main className="max-w-xl mx-auto px-4">{props.children}</main>
    </body>
  </html>
);