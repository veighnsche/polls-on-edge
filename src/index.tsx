import { Hono } from "hono";
import { showRoutes } from "hono/dev";
import { LandingPage } from "./components/LandingPage";
import { Layout } from "./components/Layout";
import { anonJwtCookie } from "./middleware/anonJwtCookie";
import { CreatePage } from "./components/CreatePage";

const app = new Hono();

// Custom cookie middleware
// ---
// Hono App: Anonymous JWT Auth & Cookie Middleware
// ---
// This app ensures that every request has an anonymous JWT stored in an HttpOnly cookie.
// The JWT is created and set automatically if missing or invalid. All cookie parsing and
// JWT logic is handled in a single, well-documented middleware (see ./middleware/anonJwtCookie.ts).
// ---

// Register the consolidated cookie/JWT middleware for all routes
app.use("*", anonJwtCookie);

/**
 * Main route: renders the landing page inside the main layout.
 * The anonymous JWT logic above ensures all users have a valid JWT cookie before this handler runs.
 */
app.get("/", (c) =>
  c.html(
    <Layout>
      <LandingPage />
    </Layout>
  )
);

// Create route
app.get("/create", (c) =>
  c.html(
    <Layout>
      <CreatePage />
    </Layout>
  )
);

// Show all registered routes for development/debugging
showRoutes(app, { verbose: true });

export default app;
