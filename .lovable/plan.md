

## Add Location Sync + Document Sync Endpoints via API

### What already exists
- `POST /api-v1/sync` — triggers review sync (calls `fetch-reviews` internally). Already works with API key auth.

### What to add

**1. New API endpoint: `POST /api-v1/sync/locations`**
- Calls the existing `sync-locations` edge function internally via `invokeInternalFunction`
- Returns the sync result (synced count, total Google locations, inserted locations)
- Works with both API key and user token auth

**2. New API endpoint: `POST /api-v1/sync/status`**
- Calls the existing `check-sync-status` edge function internally
- Returns per-location sync status and summary
- Useful for checking if reviews are up to date before triggering a sync

**3. Update Docs page**
Add documentation for all three sync endpoints:
- `POST /sync` — Sync reviews from Google (already exists, just undocumented or needs update)
- `POST /sync/locations` — Sync locations from Google Business Profile
- `POST /sync/status` — Check sync status across all locations

### Files to change
- `supabase/functions/api-v1/index.ts` — Add two new route handlers before the 404 fallback
- `src/pages/Docs.tsx` — Add sync endpoints to API documentation

