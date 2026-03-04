
Goal: turn Review Hub from a standalone app with fragile Google reconnect behavior into a platform-ready product with 1) stable user login, 2) durable Google Business connection management, 3) a real API surface for other apps, and 4) built-in docs.

What I found in the current code
- App auth is custom and tightly coupled to Google OAuth:
  - `src/pages/Login.tsx` starts Google OAuth directly.
  - `src/pages/AuthCallback.tsx` calls `google-auth`, which creates/fetches a user and generates a magic link.
  - `supabase/functions/google-auth/index.ts` stores Google access/refresh tokens on `profiles`.
- Most app reads are direct database reads from the client:
  - `useLocations`, `useReviews`, settings/profile reads.
- Most side effects are backend functions:
  - `fetch-reviews`, `post-reply`, `generate-reply`, `sync-locations`, `check-connection`, etc.
- Google token refresh exists, but it is duplicated across functions and tied to the profile row.
- Security/architecture concern:
  - Google tokens are stored on `profiles`.
  - `received_emails` has RLS enabled but no policies.
  - Several functions still use the older JWT pattern and should be normalized.

Recommended direction
Use this project as the review-management domain, but refactor it into 4 layers:

```text
Platform identity
  -> Google Business connection
  -> Internal API layer
  -> Review Hub UI + external integrations + docs
```

Implementation plan

1. Decouple app login from Google Business connection
- Replace the current “Google login = app login” flow with standard app auth for user identity.
- Keep Google only as a connected integration users authorize after login.
- Result:
  - users stay logged into the app independently of Google token churn
  - reconnecting Google does not sign them out of the platform
  - easier to embed inside a larger platform later

2. Introduce a proper Google connection model
- Create a dedicated table like `google_connections` scoped to the authenticated user for now.
- Move Google OAuth credentials and metadata out of `profiles`.
- Store:
  - access token
  - refresh token
  - expires_at
  - scopes granted
  - Google account email/name
  - connection status
  - last refresh / last sync / last error
- Add a single shared backend helper pattern for:
  - validating auth
  - loading the active Google connection
  - refreshing tokens when needed
  - persisting refreshed credentials
- Refactor all Google-touching functions (`fetch-reviews`, `post-reply`, `list-locations`, `sync-locations`, `check-connection`) to use that shared connection flow.

3. Make “stay logged in” reliable
- App session:
  - keep standard persistent app auth/session handling
  - add a proper auth guard/provider instead of ad hoc checks inside pages
- Google connection:
  - rely on refresh tokens for long-lived Google access
  - show connection health in settings: connected / token refreshed / reauth needed
  - only require reconnection when Google actually invalidates refresh access or scopes change
- Important nuance:
  - permanent app login and permanent Google API access are different things
  - the goal is “persistent app session + durable Google connection with automatic refresh”

4. Build a first-class API surface for other apps
- Add versioned backend endpoints/functions such as:
  - `GET /api/v1/locations`
  - `GET /api/v1/reviews`
  - `GET /api/v1/reviews/:id`
  - `POST /api/v1/reviews/:id/generate-reply`
  - `PUT /api/v1/reviews/:id/reply`
  - `POST /api/v1/sync`
  - `GET /api/v1/connection/status`
- Since you chose user-token auth:
  - external apps authenticate using the user’s app session/JWT or an OAuth-style delegated token flow later
  - short term: authenticated API endpoints that validate the bearer token and operate on that user’s scoped data
- Normalize response shapes:
  - pagination
  - filtering by location, rating, archive state, date range
  - structured errors
  - idempotency for write actions where useful

5. Shift the UI toward consuming the API layer
- Today the frontend often queries tables directly.
- Refactor key screens to consume the new API/service layer instead of raw table reads where integration logic matters.
- Keep simple internal reads where appropriate, but route cross-platform behavior through stable endpoints.
- This makes it easier to:
  - reuse Review Hub inside a bigger platform
  - expose the same capabilities externally
  - document one stable contract

6. Add a docs surface
Two good options:
- `/docs` inside this app first
- later move to `docs.reviewreplymanager.com` when you want a dedicated docs site

Suggested first version:
- docs landing page
- auth guide
- endpoints reference
- request/response examples
- webhook/events section later if needed
- “Connect Google Business” guide
- rate limits and error codes
- example integration snippets

7. Platform-integration shape
Best near-term architecture:
- Keep this codebase as the review-management bounded context.
- Expose it inside the bigger platform under a route like `/platform/reviews` or `/workspace/:id/reviews`.
- Replace only:
  - login shell
  - top-level navigation
  - platform-wide auth/session wrapper
- Preserve:
  - review sync logic
  - AI reply generation
  - Google posting/sync workflows
  - audit/analytics screens

Database/backend changes I would plan
- New table: `google_connections`
- Optional later tables if you go multi-tenant:
  - `organizations`
  - `organization_members`
  - `organization_google_connections`
- Keep roles in a separate roles table if/when admin roles are introduced
- Add/repair RLS for any new tables and fix missing RLS policy coverage on existing inbox-related tables
- Move sensitive Google credentials away from general profile usage

Technical cleanup included in the plan
- Replace repeated token refresh logic with one reusable server-side module/pattern
- Standardize edge functions to current auth validation guidance
- Improve CORS headers on web-called functions
- Add consistent audit logging for API-originated actions
- Define API DTOs/types so UI and integrations use the same contracts
- Add docs-friendly examples for:
  - list reviews
  - sync reviews
  - generate reply
  - post reply

Suggested rollout phases
Phase 1: Stabilize auth/connectivity
- decouple login from Google connection
- create `google_connections`
- refactor connection + refresh flow
- improve settings diagnostics

Phase 2: Publish internal API
- add versioned endpoints for locations/reviews/replies/sync
- convert the main dashboard workflows to use them

Phase 3: Docs
- add `/docs`
- document auth, endpoints, examples, errors

Phase 4: Bigger platform readiness
- shared auth shell
- route embedding
- optional org/workspace tenancy upgrade

Key decision notes
- Your selected auth model (“User token”) is a good first step for first-party and light partner integrations.
- If you later want Zapier/Make/CRM-style third-party access without a signed-in browser session, add API keys or OAuth clients in a second phase.
- I would not jump straight to a public API before separating app auth from Google connection first. That coupling is the main source of fragility today.

What this would give you
- users remain signed into Review Hub reliably
- Google reconnect prompts happen much less often
- other apps can read reviews and post replies through supported endpoints
- Review Hub becomes embeddable in a larger platform
- you have a clean path to `/docs` now and `docs.reviewreplymanager.com` later

If I implement this, I would start with:
1. auth/Google-connection separation
2. shared Google token lifecycle handling
3. versioned review/location/reply API endpoints
4. `/docs` page with initial API reference
