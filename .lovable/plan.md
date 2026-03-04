
Goal: connect Review Hub to your other website in a way that works for a backend/server, not just a logged-in browser.

What exists today
- You already have a usable API surface at `/functions/v1/api-v1`.
- It supports:
  - connection status
  - locations
  - reviews
  - generate reply
  - post reply
  - sync
- But it currently uses user bearer tokens from an active app session.
- That is fine for browser-based integrations, but not ideal for server-to-server access from another website.

Recommended approach
Use a dedicated server-to-server integration model instead of copying your personal user token into another backend.

```text
Other website backend
  -> sends API key / integration token
  -> Review Hub API validates it
  -> Review Hub maps it to your account/workspace
  -> API reads reviews / syncs / posts replies
```

Why this is the right next step
- Safer than reusing your browser session token
- More stable for cron jobs, background syncs, and external platforms
- Easier to rotate/revoke access if another site changes
- Better foundation for docs and future public integrations

Plan
1. Add server-to-server credentials
- Create an `api_keys` or `integration_tokens` table
- Store:
  - id
  - hashed key
  - owner user_id
  - label/name
  - last_used_at
  - created_at
  - revoked_at
- Keep raw keys hidden after creation
- Add strict RLS so users only manage their own keys

2. Extend the API auth layer
- Update the shared auth helper used by `api-v1`
- Support two auth modes:
  - existing user bearer token
  - new server API key
- Resolve every request to one internal user identity so existing data scoping still works

3. Upgrade the Integrations page
- Add a “Create API key” flow
- Show:
  - active keys
  - last used time
  - revoke button
  - usage guidance for backend integrations
- Keep current connection-health and example sections

4. Add backend-ready examples
- Expand `/docs` and `/integrations` with:
  - cURL examples using `x-api-key`
  - Node/Express example
  - Laravel / PHP example
  - webhook / cron sync examples
- Explain which endpoints are safe for server use and what payloads they expect

5. Clarify the connection flow for your other website
- Your other site backend will:
  - store the Review Hub API key securely
  - call Review Hub endpoints on a schedule or on demand
  - fetch reviews
  - create/generate replies
  - post approved replies
- Your frontend site should call your own backend, not Review Hub directly, for this integration model

6. Keep Google connection separate
- Your Review Hub login remains independent
- Google Business access remains managed inside Review Hub
- Your other website does not need direct Google credentials
- It only talks to Review Hub’s API

Suggested endpoint shape after this change
- `GET /api-v1/connection/status`
- `GET /api-v1/locations`
- `GET /api-v1/reviews`
- `GET /api-v1/reviews/:id`
- `POST /api-v1/reviews/:id/generate-reply`
- `PUT /api-v1/reviews/:id/reply`
- `POST /api-v1/sync`

Technical notes
- The current architecture already supports most of this cleanly because `api-v1` is acting as a gateway.
- The biggest missing piece is server-grade authentication.
- I would avoid “permanent login” tokens for another backend; long-lived API keys are the better fit for your stated use case.
- Later, if you want third-party marketplace integrations, we can add:
  - scoped API keys
  - webhooks
  - org/workspace auth
  - OAuth clients

What I would build next
1. API key model + secure hashing
2. `api-v1` support for API-key auth
3. Integrations page key management UI
4. Docs for backend/server integration
5. Optional request logging / rate limits

After that, connecting your other website becomes simple:
- generate an API key in Review Hub
- save it in your other website’s backend secrets
- call the documented endpoints from that backend

<lov-actions>
<lov-suggestion message="Test the API flow end-to-end by generating a key, calling the review endpoints from a backend script, and posting a reply through the integration.">Verify that it works</lov-suggestion>
<lov-suggestion message="Implement server-to-server API keys for Review Hub so my other website backend can authenticate without using a browser session token.">Add API Keys</lov-suggestion>
<lov-suggestion message="Expand the integrations page with API key creation, revoke controls, last-used timestamps, and backend connection instructions.">Upgrade Integrations</lov-suggestion>
<lov-suggestion message="Add backend-focused docs with cURL, Node, and PHP examples for syncing reviews and posting replies from another website.">Write Backend Docs</lov-suggestion>
<lov-suggestion message="Add webhook events and request logging so external platforms can sync review changes automatically instead of polling.">Add Webhooks</lov-suggestion>
</lov-actions>
