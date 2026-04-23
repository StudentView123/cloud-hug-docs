/**
 * Helpers for building deep links into Google's owner-side review surfaces.
 * No new Google API calls — everything is built from the place_id we already store.
 */

/**
 * Canonical Google reviews list for a place. This is where the "Report review"
 * action lives in Google's own UI.
 */
export const buildGoogleReviewsUrl = (placeId: string): string =>
  `https://search.google.com/local/reviews?placeid=${encodeURIComponent(placeId)}`;

/**
 * Open the place directly in Google Maps.
 */
export const buildGoogleMapsUrl = (placeId: string): string =>
  `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}`;
