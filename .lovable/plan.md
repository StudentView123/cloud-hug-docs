
What to do right now

1. Log into Review Hub
- You’re currently on `/login`, so first sign in to the app.
- After logging in, open `/integrations`.

2. Make sure your Google connection is healthy
- On the Integrations page, check:
  - Status
  - Google account
  - Last sync
  - Token expiry
- If it says “Needs reconnection”, reconnect your Google account in Settings before using the API.

3. Create an API key
- In Integrations, create a new API key for your other website/backend.
- Copy the key immediately and save it in your backend secrets.
- Treat it like a password.

4. Put the key in your other website’s backend
- Store it as something like:
```text
REVIEW_HUB_API_KEY=your_key_here
```
- Important: use it only on your server/backend, not in browser code.

5. Call the API from your backend
Base URL:
```text
https://rctsewtjmzkxfqsmgqcc.supabase.co/functions/v1/api-v1
```

Send this header on every request:
```text
x-api-key: YOUR_API_KEY
```

Useful endpoints
- `GET /connection/status`
- `GET /locations`
- `GET /reviews?limit=25&page=1`
- `GET /reviews/:id`
- `POST /reviews/:id/generate-reply`
- `PUT /reviews/:id/reply`
- `POST /sync`

Fastest working examples

List reviews:
```bash
curl -X GET "https://rctsewtjmzkxfqsmgqcc.supabase.co/functions/v1/api-v1/reviews?limit=10&page=1" \
  -H "x-api-key: YOUR_API_KEY"
```

Check connection health:
```bash
curl -X GET "https://rctsewtjmzkxfqsmgqcc.supabase.co/functions/v1/api-v1/connection/status" \
  -H "x-api-key: YOUR_API_KEY"
```

Node backend example:
```js
const response = await fetch("https://rctsewtjmzkxfqsmgqcc.supabase.co/functions/v1/api-v1/reviews?limit=10&page=1", {
  headers: {
    "x-api-key": process.env.REVIEW_HUB_API_KEY,
  },
});

const data = await response.json();
console.log(data);
```

Reply flow
1. Fetch reviews
2. Pick a review ID
3. Generate a draft reply
4. Post that draft reply

Generate draft:
```bash
curl -X POST "https://rctsewtjmzkxfqsmgqcc.supabase.co/functions/v1/api-v1/reviews/REVIEW_ID/generate-reply" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

Post reply:
```bash
curl -X PUT "https://rctsewtjmzkxfqsmgqcc.supabase.co/functions/v1/api-v1/reviews/REVIEW_ID/reply" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"replyId":"DRAFT_REPLY_ID"}'
```

Recommended architecture
```text
Your website frontend
  -> calls your own backend
Your backend
  -> stores REVIEW_HUB_API_KEY
  -> calls Review Hub API
Review Hub
  -> reads reviews / syncs / generates replies / posts replies
```

Important notes
- Do not call Review Hub directly from your frontend.
- Do not expose the API key in client-side JavaScript.
- If `/sync` or reply posting fails, first check connection health in Integrations.

Best next build step
- Add this flow to your other website backend:
  - scheduled `POST /sync`
  - `GET /reviews`
  - internal admin action for generate/post reply

If you want, the next implementation step should be:
- add a “Test connection” section to Integrations that generates ready-to-paste code for your exact backend stack
- add webhook support so your other website doesn’t need to poll for new reviews
