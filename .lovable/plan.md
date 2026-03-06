

## Add Place ID to Locations

### Goal
Add a `place_id` column to the `locations` table, resolve Place IDs from Google Places API during sync, expose them in the API, and document it.

### Database
- Add `place_id text` (nullable) column to `locations` table via migration.

### Backend: Resolve Place IDs during sync
- In `sync-locations/index.ts`, after inserting a new location, call Google Places Text Search API (`https://places.googleapis.com/v1/places:searchText`) using the location's name + address as the query.
- Requires a Google API key with Places API enabled. The existing `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are OAuth credentials, not an API key. A `GOOGLE_API_KEY` secret will be needed.
- Store the returned `place.id` in the `place_id` column.
- For existing locations missing a `place_id`, add a new edge function `resolve-place-ids` that backfills them on demand.

### API
- Update the `GET /locations` response in `api-v1` to include `place_id`.
- Add `GET /locations/:id` endpoint returning a single location with its `place_id`.

### UI
- Show the Place ID on the Locations page cards when available.

### Docs
- Add `place_id` to the `/locations` endpoint documentation in `Docs.tsx`.

### Important consideration
The Google Places Text Search API requires a standard API key (not OAuth). Need to confirm whether `GOOGLE_API_KEY` is already available or needs to be added as a secret. Based on the current secrets list, it is **not** present — the user will need to provide one.

### Steps
1. Add `place_id` column to `locations` table (migration)
2. Add `GOOGLE_API_KEY` secret
3. Update `sync-locations` to resolve Place IDs for new locations during sync
4. Create `resolve-place-ids` edge function for backfilling existing locations
5. Update `api-v1` to expose `place_id` in location responses
6. Update Locations page UI to display Place ID
7. Update Docs page with `place_id` field documentation

