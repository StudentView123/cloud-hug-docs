

## Disputes Page — Aggregate 1★ Reviews with Direct Google Links

### Reality check (important)
Google Business Profile API does **not** expose per-review permalinks like `https://maps.app.goo.gl/...`. Those short links are generated only inside Google Maps and aren't returned by any API. There is also no public API to "report" or "dispute" a review.

The closest thing we *can* build reliably is a **deep link per review's location** that takes you straight to that business's Google reviews page, where the "Report review" / flag action lives. With the `place_id` we already resolved, this works for every location.

### What gets built

**1. New page: `/disputes`**
A focused workspace listing every 1★ review (optionally 1–2★) across all locations, sorted newest-first, with one-click access to Google for flagging.

Layout per row:
- Author, rating (1★ badge in red), date, location name
- Full review text
- Sentiment badge + sentiment-mismatch warning if present
- Action buttons:
  - **Open on Google** → `https://search.google.com/local/reviews?placeid={place_id}` (opens the location's Google reviews list in a new tab — this is where the owner clicks "Report review")
  - **Open in Maps** → `https://www.google.com/maps/place/?q=place_id:{place_id}`
  - **Copy review text** (handy for filing a separate Google support dispute)
  - **Archive** / **Mark disputed** (local status only)

**2. Filters at the top**
- Rating: 1★ only (default) / 1–2★ / custom
- Location dropdown (reuse existing pattern from Dashboard)
- Date range (last 30/90/all)
- Hide reviews already marked disputed
- Search by author/text

**3. Summary header**
- Total 1★ count, count in last 30 days, count by location (top 3), % of total reviews that are 1★

**4. "Dispute status" tracking (local)**
Add a lightweight column `dispute_status` to `reviews` (`none | flagged | resolved | rejected`) plus optional `dispute_notes` and `disputed_at`. Lets users track which reviews they've already reported to Google and the outcome — Google itself gives no API feedback on this.

**5. Sidebar nav entry**
Add "Disputes" item in `AppSidebar.tsx` with a flag/alert icon, showing a count badge of unhandled 1★ reviews.

**6. Missing place_id handling**
For any 1★ review whose location lacks a `place_id`, show an inline "Resolve Place ID" button that calls the existing `resolve-place-ids` function so the link can be generated.

### Files to change
- `supabase/migrations/` — new migration: add `dispute_status text default 'none'`, `dispute_notes text`, `disputed_at timestamptz` to `reviews`
- `src/pages/Disputes.tsx` — new page
- `src/hooks/useDisputes.tsx` — new hook (queries 1★ reviews with location join)
- `src/components/AppSidebar.tsx` — add nav entry + unhandled count badge
- `src/App.tsx` — register `/disputes` protected route
- `src/lib/googleLinks.ts` — small helper: `buildGoogleReviewsUrl(place_id)`, `buildGoogleMapsUrl(place_id)`
- `supabase/functions/api-v1/index.ts` — add `dispute_status` to review responses + new `PATCH /reviews/:id/dispute` endpoint so external systems can update status
- `src/pages/Docs.tsx` — document the new field and endpoint

### Technical notes
- No new Google API calls — `place_id` is already in the DB after the resolve step
- The `search.google.com/local/reviews?placeid=` URL is the canonical owner-side reviews view; it's stable and what Google's own help docs link to for the "Report a review" workflow
- Star-filter URL params on Maps are not officially stable, so we don't rely on them; the page lands on the reviews list and the user filters by 1★ in Google's UI (one click)
- All existing RLS on `reviews` continues to apply — dispute fields inherit the same access rules

### What this does NOT do
- Does not generate `maps.app.goo.gl` short links (Google-internal, no API)
- Does not auto-submit disputes to Google (no API exists; this is always a manual owner action)
- Does not guarantee Google removes the review — the page just makes the manual reporting flow as fast as possible and tracks status locally

