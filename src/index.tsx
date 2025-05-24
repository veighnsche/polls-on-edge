import { Hono } from "hono";
import type { FC } from "hono/jsx";
import { useState } from "hono/jsx";
import { showRoutes } from "hono/dev";

const app = new Hono();

const Layout: FC = (props) => {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Honori</title>
        <link rel="stylesheet" href="/dist/styles.css" />
      </head>
      <body className="min-h-screen bg-background text-foreground">
        <header className="py-6 shadow-md mb-8 bg-primary">
          <h1 className="text-3xl font-bold text-center tracking-wide text-primary-foreground">Honori</h1>
        </header>
        <main className="max-w-xl mx-auto px-4">{props.children}</main>
      </body>
    </html>
  );
};

const Top: FC<{ messages: string[] }> = (props: { messages: string[] }) => {
  const [count, setCount] = useState(0);
  return (
    <Layout>
      <section className="rounded-xl shadow p-8 flex flex-col items-center bg-card">
        <h1 className="text-2xl font-semibold mb-4 text-primary">Hello Hono!</h1>
        <div className="flex flex-col items-center mb-6">
          <h2 className="text-lg font-medium mb-2">
            Counter: <span className="font-mono text-primary">{count}</span>
          </h2>
          <div className="flex gap-4">
            <button
              type="button"
              className="w-10 h-10 rounded-full text-xl font-bold shadow transition bg-destructive text-destructive-foreground"
              onClick={() => setCount(count - 1)}
              aria-label="Decrement"
            >
              -
            </button>
            <button
              type="button"
              className="w-10 h-10 rounded-full text-xl font-bold shadow transition bg-accent text-accent-foreground"
              onClick={() => setCount(count + 1)}
              aria-label="Increment"
            >
              +
            </button>
          </div>
        </div>
        <ul className="w-full mt-4 space-y-2">
          {props.messages.map((message, i) => (
            <li
              key={i}
              className="rounded px-4 py-2 font-medium shadow-sm bg-secondary text-secondary-foreground"
            >
              {message}!!
            </li>
          ))}
        </ul>
      </section>
    </Layout>
  );
};

app.get("/", (c) => {
  const messages = ["Good Morning", "Good Evening", "Good Night"];
  return c.html(<Top messages={messages} />);
});

showRoutes(app, {
  verbose: true,
});

export default app;
