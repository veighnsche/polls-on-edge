# Honory: Serverless Poll App

A modern, serverless poll application built on Cloudflare Durable Objects, Hono, TypeScript, and React. Easily create, vote on, and manage polls with secure, scalable, and real-time state management.

---

## 🚀 Features

- **Create, edit, and delete polls** (with authentication)
- **Vote on polls** (prevents double-voting, tracks votes per user)
- **View poll results and lists**
- **User authentication** via JWT (anonymous or registered)
- **Cloudflare Durable Objects** for persistent, scalable state
- **Type-safe API** with Zod validation
- **Modern UI** using React and TailwindCSS

---

## 🛠 Tech Stack

- **Frontend:** React (TSX), TailwindCSS
- **Backend:** Cloudflare Workers, Durable Objects, Hono framework
- **Validation:** Zod
- **Build Tools:** pnpm, Wrangler, TailwindCSS CLI
- **Dev Tools:** Miniflare, Prettier, ESLint

---

## 📁 Directory Structure

```text
/src
  /components         # React pages and UI components
  /durable-objects    # Poll and User Durable Object logic
  /services           # Poll service logic and utilities
  /middleware         # Middleware (e.g., JWT cookies)
  /types              # TypeScript type definitions
  index.tsx           # Main app entry, routes, API
  tailwind.css        # TailwindCSS entry
public/               # Static assets
```

---

## 🏗 Durable Object Architecture

- **PollDurableObject:**
  - Manages poll data, vote counts, and coordinates with UserDurableObject to prevent double-voting.
- **UserDurableObject:**
  - Tracks each user's owned polls and votes, ensuring data integrity and ownership.

---

## ⚡️ Getting Started

1. **Install dependencies:**
   ```sh
   pnpm install
   ```
2. **Start development server:**
   ```sh
   pnpm dev
   ```
   Runs Wrangler dev server and TailwindCSS in watch mode.
3. **Build for production:**
   ```sh
   pnpm build
   ```
4. **Deploy to Cloudflare Workers:**
   ```sh
   pnpm deploy
   ```

### Configuration
- Durable Object bindings and secrets are managed in `wrangler.jsonc`.
- TailwindCSS config in `postcss.config.js` and `src/tailwind.css`.

---

## 📜 Main Scripts

- `dev`: Concurrently runs Wrangler and Tailwind in watch mode
- `build`: Builds Tailwind CSS
- `deploy`: Deploys to Cloudflare
- `cf-typegen`: Generates Cloudflare type bindings

---

## 🤝 Contributing

- Code style enforced with Prettier and ESLint
- Type safety via TypeScript and Zod
- PRs and issues welcome!

---

## License

MIT
