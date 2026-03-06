

## Fix Place ID Resolution Without Reconnect

### Root cause
The stored OAuth token has scopes `[business.manage, userinfo.email, userinfo.profile, openid]` — missing `cloud-platform` which the Places API requires. Even though the frontend code was updated to request this scope, the user hasn't reconnected, so the stored token lacks it.

### Solution
Instead of calling the Google Places API (which needs `cloud-platform` scope), extract `place_id` directly from the **Google Business Profile API** which the existing token already has access to. The GBP location resource includes `metadata.placeId` when you add `metadata` to the `readMask`. This requires zero new secrets and zero reconnection.

### Changes

**1. Update `resolve-place-ids` edge function**
- Replace the Places Text Search API calls with a GBP API call
- Fetch all locations from `mybusinessaccountmanagement.googleapis.com` with `readMask=name,title,metadata`
- Extract `metadata.placeId` from each location
- Match against DB locations by `google_location_id` and update `place_id`

**2. Update `sync-locations` edge function**
- Add `metadata` to the `readMask` parameter
- When inserting new locations, directly set `place_id` from `metadata.placeId`
- Remove the Places API fallback code (lines 75-107)

**3. Remove `cloud-platform` scope from `googleConnection.ts`**
- Since we no longer need the Places API via OAuth, remove `https://www.googleapis.com/auth/cloud-platform` from the scope list to keep permissions minimal

### Files to change
- `supabase/functions/resolve-place-ids/index.ts` — rewrite to use GBP metadata
- `supabase/functions/sync-locations/index.ts` — add metadata to readMask, set place_id on insert
- `src/lib/googleConnection.ts` — remove cloud-platform scope

