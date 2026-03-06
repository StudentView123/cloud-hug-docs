

## Implement Place ID Resolution

The Places API (New) accepts OAuth 2.0 bearer tokens, so we can reuse the existing access token from `getValidGoogleAccessToken` — no new secret required.

### Changes

**1. Update `sync-locations/index.ts`**
- After inserting each new location, call Google Places Text Search API using the OAuth access token
- Query: `"{location.title}, {location.address}"`
- Extract `place.id` from the first result and update the location record
- Non-blocking: if Place ID resolution fails for a location, log and continue

**2. Create `resolve-place-ids/index.ts` edge function**
- Backfill endpoint: finds all locations for the user where `place_id IS NULL`
- For each, calls Places Text Search with `name + address`
- Updates each location with the resolved Place ID
- Returns count of resolved locations
- Add to `config.toml` with `verify_jwt = true`

**3. Update `api-v1/index.ts`**
- Add `place_id` to the `GET /locations` select query
- Add `GET /locations/:id` endpoint returning a single location with `place_id`

**4. Update `src/pages/Locations.tsx`**
- Show Place ID on each location card when available (small muted text)
- Add a "Resolve Place IDs" button that calls the backfill function

**5. Update `src/pages/Docs.tsx`**
- Add `place_id` field to the `/locations` endpoint documentation
- Add the new `GET /locations/:id` endpoint to the endpoints list

**6. Update `src/hooks/useLocations.tsx`**
- Add `place_id` to the Location interface and query select

### Places API call pattern (used in edge functions)
```text
POST https://places.googleapis.com/v1/places:searchText
Headers:
  Authorization: Bearer {accessToken}
  Content-Type: application/json
  X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress
Body:
  { "textQuery": "Business Name, Street Address" }
```

The `places.id` in the response is the Google Place ID.

