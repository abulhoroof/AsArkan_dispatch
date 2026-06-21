# AsArkan Dispatch

Open-source B2B truck dispatching and transportation management system (TMS). Built for small and mid-size trucking fleets to manage loads, drivers, routing, and real-time fleet coordination.

Licensed under [AGPL-3.0](./LICENSE).

## Tech stack

- **Frontend**: React 18, TypeScript, Vite
- **UI**: shadcn/ui, Tailwind CSS, lucide-react
- **State**: TanStack React Query, React Context
- **Routing**: React Router v6
- **Backend**: Supabase (Auth, Postgres, Row Level Security, Edge Functions, Realtime)
- **Forms**: react-hook-form + zod

## Architecture

- Multi-tenant via `organization_id` on all tables, enforced by Postgres RLS policies.
- Organization is resolved from the request subdomain (`useSubdomain` → `OrganizationContext`).
- Real-time updates via Supabase channels, scoped per organization.

For domain entities, lifecycles, and business rules, see [`ontology.md`](./ontology.md).

## Getting started

### Prerequisites

- Node.js 18+
- A Supabase project ([create one for free](https://supabase.com))
- Supabase CLI for migrations and edge functions ([install guide](https://supabase.com/docs/guides/cli))

### Setup

```bash
# 1. Clone and install
git clone https://github.com/abulhoroof/AsArkan_dispatch.git
cd AsArkan_dispatch
npm install

# 2. Configure env vars
cp .env.example .env
# Edit .env and fill in your Supabase URL + anon key

# 3. Link the Supabase CLI to your project
supabase link --project-ref <your-project-ref>

# 4. Apply database migrations
supabase db push

# 5. Deploy edge functions
supabase functions deploy

# 6. Start the dev server
npm run dev
```

## Project layout

```
src/pages/              Page components (lazy-loaded, default export)
src/components/         Application components
src/components/ui/      shadcn/ui primitives
src/hooks/              Custom hooks (data fetching, state)
src/contexts/           React contexts (Organization, Settings)
src/types/              TypeScript interfaces
src/integrations/       Supabase client and generated types
supabase/migrations/    SQL migrations
supabase/functions/     Edge functions (Deno)
```

## Scripts

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npm run preview      # Preview production build
```

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, conventions, and pull request guidelines.

## Security

To report a security vulnerability, please follow the process in [SECURITY.md](./SECURITY.md). Do not file a public GitHub issue for security reports.

## License

AsArkan Dispatch is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. This means any modified version you run as a network service must make its source code available to users of that service. See [LICENSE](./LICENSE) for the full text.
