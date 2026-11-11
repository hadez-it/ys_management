# YS SVC (`ys-svc`)

YS SVC is a full-stack service job tracking, technician dispatch, inventory, and invoice management application for computer repair and service shops.

- **Frontend**: React 19 + Vite + Tailwind CSS v4 SPA
- **Backend**: Express + Mongoose API on MongoDB Atlas (`api/index.ts`)
- **Deployments**:
  - **Netlify**: Static SPA published from `dist/`, with `/api/*` routed to `netlify/functions/api.ts` (`serverless-http` wrapper around `api/index.ts`).
  - **Node / Cloud Run**: `server.ts` serves both the API and built static assets (`dist/server.cjs`).
  - **Vercel**: Serverless function entry point at `api/index.ts`.

---

## Local Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Configure environment variables**:
   Copy `.env.example` to `.env` and populate the required secrets.
   Generate strong secrets with:
   ```bash
   openssl rand -base64 48
   ```
3. **Run development server**:
   ```bash
   npm run dev
   ```
   The development server listens on `http://localhost:3000` (or `PORT` if set).
4. **Typecheck and build**:
   ```bash
   npm run lint
   npm run build
   ```

---

## Environment Variables (Names Only)

Configure the following environment variable **names** in `.env` (local) or in your deployment platform's Environment Variables settings:

| Variable Name | Required | Description |
| :--- | :--- | :--- |
| `MONGO_URI` | **Yes** | MongoDB Atlas connection string (`mongodb+srv://...`). |
| `JWT_SECRET` | **Yes** | Secret key for signing `httpOnly` session JWTs. Must be at least 32 characters and not a placeholder (`openssl rand -base64 48`). |
| `INITIAL_ADMIN_PASSWORD` | **Yes (for initial seed & system reset)** | Initial password (minimum 12 characters) for the default `admin` user when seeding an empty database or running `/api/system/reset`. |
| `INITIAL_COORDINATOR_PASSWORD` | Optional | Initial password (minimum 12 characters) for the default `coordinator` user. If unset or `< 12` chars, this seed user is skipped. |
| `INITIAL_SENIOR_TECH_PASSWORD` | Optional | Initial password (minimum 12 characters) for the default `senior_technician` user. If unset or `< 12` chars, this seed user is skipped. |
| `INITIAL_TECHNICIAN_PASSWORD` | Optional | Initial password (minimum 12 characters) for the default `technician` user. If unset or `< 12` chars, this seed user is skipped. |
| `GEMINI_API_KEY` | Optional | Google Gemini API key used by `POST /api/parse-ticket` for bilingual ticket auto-extraction. |
| `APP_URL` | Optional | Canonical origin URL allowed by CORS (in addition to Netlify's automatic `URL` variable). |
| `PORT` | Optional | HTTP port for `server.ts` (defaults to `3000`). |

---

## Netlify Deployment Notes

- **Build command**: `npm run build`
- **Publish directory**: `dist`
- **Functions directory**: `netlify/functions` (bundled with `esbuild`)
- **Routing**: `netlify.toml` redirects `/api/*` to `/.netlify/functions/api/:splat` (status `200`, `force = true`) before the SPA fallback `/* -> /index.html`.
- **Stateless Security**: Because Netlify Functions are ephemeral and scale horizontally, authentication state (`tokenVersion` revocation), login brute-force throttling (`LoginAttempt` TTL collection), and AI ticket-parse rate limiting (`ParseTicketRateLimit` TTL collection) are persisted in MongoDB rather than in-memory Maps. Client IPs are resolved from `x-nf-client-connection-ip` first, then `req.ip`.

---

## Role Authorization Matrix

All protected `/api/*` routes verify the `httpOnly` session cookie against the live MongoDB `User` record and `tokenVersion` before checking role permissions via `requireRole(...)`:

| Endpoint / Action | `admin` | `coordinator` | `senior_technician` | `technician` |
| :--- | :---: | :---: | :---: | :---: |
| `GET /api/db-status` | Public | Public | Public | Public |
| `POST /api/auth/login`, `POST /api/auth/logout` | Public | Public | Public | Public |
| `GET /api/auth/me` | Yes | Yes | Yes | Yes |
| `GET /api/jobs` | Yes | Yes | Yes | Yes |
| `POST /api/jobs` | Yes | Yes | No (`403`) | No (`403`) |
| `PUT /api/jobs/:id` (full allowed fields) | Yes | Yes | Yes | Restricted* |
| `DELETE /api/jobs/:id` | Yes | Yes | No (`403`) | No (`403`) |
| `GET /api/deleted-jobs` | Yes | Yes | No (`403`) | No (`403`) |
| `GET /api/activity-logs` | Yes | Yes | No (`403`) | No (`403`) |
| `GET /api/invoices` | Yes | Yes | Yes | No (`403`) |
| `POST /api/invoices` | Yes | Yes | Yes | No (`403`) |
| `GET /api/inventory`, `/logs`, `/categories` | Yes | Yes | Yes | Yes |
| `POST /api/inventory` | Yes | Yes | Yes | No (`403`) |
| `PATCH /api/inventory/:id` | Yes | Yes | Yes | No (`403`) |
| `POST /api/inventory/transaction` | Yes | Yes | Yes | No (`403`) |
| `POST /api/parse-ticket` | Yes | Yes | Yes | Yes |
| `GET / POST / PUT / DELETE /api/users*` | Yes | No (`403`) | No (`403`) | No (`403`) |
| `POST /api/system/reset` | Yes | No (`403`) | No (`403`) | No (`403`) |

*\*`technician` on `PUT /api/jobs/:id` may only update `status`, `diagnosedProblem`, `resolutionNotes`, and `remarks`; modifying any other field returns `403`.*
