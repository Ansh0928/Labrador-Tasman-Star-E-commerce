# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
bun run dev      # Start dev server
bun run build    # Production build
bun run lint     # Run ESLint
```

No test suite is configured.

## Architecture

**LABRADOR-TASMANSTAR** is a customer loyalty + messaging app for Tasman Star Seafoods (a seafood retailer). Customers scan a QR code in-store to sign up; the admin uses the dashboard to blast messages via email and web push.

### Stack
- **Next.js 16.2** (App Router) — read `node_modules/next/dist/docs/` before writing Next.js code
- **React 19** + TypeScript
- **Firebase** — Firestore for data, Firebase Auth for admin login
- **Resend** — transactional email
- **web-push** — web push notifications (VAPID)
- **@21st-sdk** — AI agent framework (chat page + `agents/` directory)

### Data model (Firestore)

| Collection | Key fields |
|---|---|
| `customers` | `fullName`, `mobile`, `email`, `optIn`, `pushSubscription`, `signupDate`, `source` |
| `messages` | `text`, `sentAt`, `recipientCount`, `emailCount`, `pushCount`, `sentBy` |

### Routes

| Path | Purpose |
|---|---|
| `/` | Redirects to `/signup` |
| `/signup` | Customer-facing QR code landing page — splits into carousel (left) + form (right). Writes to Firestore `customers`, registers push subscription. |
| `/thank-you` | Post-signup confirmation |
| `/admin` | Admin dashboard (Firebase Auth-gated). Single-page with sidebar nav: Dashboard, Customers, Send Message, Settings. |
| `/admin/login` | Admin login (Firebase Auth) |
| `/chat` | 21st-sdk AI agent chat (uses `agents/my-agent.ts`) |

### API routes

| Route | What it does |
|---|---|
| `POST /api/send-email` | Sends email blast via Resend to an array of addresses |
| `POST /api/send-notification` | Sends web push to an array of push subscriptions (VAPID) |
| `POST /api/an-token` | Issues a 21st-sdk agent auth token |
| `POST /api/agents/my-agent` | 21st-sdk agent endpoint (placeholder — adds two numbers) |

### Agent

`agents/my-agent.ts` defines the 21st-sdk agent (model: `claude-sonnet-4-6`). The `/chat` page connects to it via `createAgentChat`. The agent token endpoint is `/api/an-token`.

### Key patterns

- `src/lib/firebase.ts` — singleton Firebase client (uses `memoryLocalCache` for Firestore). Import `db` and `auth` from here throughout the app.
- Admin auth is checked via `onAuthStateChanged`; unauthenticated users are redirected to `/admin/login`.
- Sending a message fires both `/api/send-notification` and `/api/send-email` independently (errors are swallowed per-channel), then writes to Firestore `messages`.
- The signup page registers a service worker (`/sw.js`) for push subscriptions at form submit time.

### Required environment variables

```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
RESEND_API_KEY
API_KEY_21ST
```
