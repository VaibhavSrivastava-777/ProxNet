# ProxNet

ProxNet helps society residents discover anonymized professionals nearby, ask questions, and chat anonymously.

## Features

- **LinkedIn OAuth** — Sign in with LinkedIn (OpenID Connect: name, email, photo)
- **Profile** — Edit company, title, locations, and visibility toggles
- **Proximity map** — Interactive map with adjustable radius (default 100m) and anonymized company clusters
- **Q&A** — Post questions to matching professionals in your radius
- **Anonymous chat** — Chat with pseudonyms when a professional responds
- **Admin panel** (`/admin`) — Secure login with `suID` / `suPWD`, manual user management

## Tech stack

- Next.js 16 (App Router), TypeScript, Tailwind CSS
- Auth.js (NextAuth v5) + LinkedIn OIDC
- Supabase (Postgres, Realtime broadcast for chat)
- react-leaflet + OpenStreetMap

## Local setup

### 1. Clone and install

```bash
npm install
cp .env.example .env.local
```

### 2. Supabase

1. Create a free project at [supabase.com](https://supabase.com)
2. Open **SQL Editor** and run [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql)
3. In **Database → Replication**, ensure `chat_messages` is enabled for Realtime (or run the migration line if supported)
4. Copy **Project URL**, **anon key**, and **service role key** into `.env.local`

### 3. LinkedIn

1. Create an app at [LinkedIn Developer Portal](https://www.linkedin.com/developers/)
2. Add product **Sign In with LinkedIn using OpenID Connect**
3. Set redirect URL: `http://localhost:3000/api/auth/callback/linkedin`
4. Copy Client ID and Client Secret to `.env.local`

### 4. Secrets and admin

```bash
# Generate NEXTAUTH_SECRET (PowerShell)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))

# Seed admin credentials
npm run seed:admin
```

### 5. Run

```bash
npm run dev
```

Visit `http://localhost:3000`

## Deployment (Vercel + Supabase)

1. Push to GitHub and import into [Vercel](https://vercel.com)
2. Add all environment variables from `.env.example`
3. Update `NEXTAUTH_URL` to your production domain
4. Add production LinkedIn redirect: `https://your-domain.vercel.app/api/auth/callback/linkedin`
5. Run `npm run seed:admin` locally against production Supabase (with production env vars) to create admin

## Admin usage

1. Go to `/admin/login`
2. Sign in with `ADMIN_SU_ID` / `ADMIN_SU_PWD` (after seeding)
3. Add users manually with name, company, LinkedIn URL, and coordinates
4. When the user signs in with LinkedIn, their record is linked and OAuth fields are refreshed

## Privacy

- Proximity API returns **aggregated** company counts with jittered coordinates
- Chat uses session aliases (`Resident-1`, `Professional-1`)
- Direct database access is blocked for anonymous clients via RLS; app APIs use the service role server-side

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run seed:admin` | Create/update admin credentials |
