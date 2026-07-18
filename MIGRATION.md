Migration: Move off Lovable-managed Supabase

Summary
- This repository previously used a Lovable-managed Supabase project. The goal is to point the app at your own Supabase instance and stop using the Lovable-managed DB.

What I changed
- Added `@supabase/server` to `package.json` dependencies (run `npm install`).
- Replaced Lovable-specific error messages in Supabase client helpers with generic env var guidance.
- Added `.env.example` with the environment variables you must set.

Next steps (manual)
1. Provision your Supabase project and get the `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY`, and `JWKS` URL.
2. Copy `.env.example` to `.env` and populate the values.
3. Run `npm install` to install `@supabase/server` and other deps.
4. If you want to use `@supabase/server` APIs server-side, update server handlers to import from `@supabase/server` instead of `@supabase/supabase-js` as needed.
5. Verify functionality locally (`npm run dev`) and run any integration tests.

Notes
- I did not change runtime code paths that create the client from `@supabase/supabase-js` to `@supabase/server` to avoid unexpected breakage; switching is optional and can be done incrementally.
