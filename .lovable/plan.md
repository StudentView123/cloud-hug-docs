
Goal: help you actually use the webhook integration you now have, so your other website can receive automatic updates instead of polling.

How it works
```text
Review Hub
  -> detects an event
     - new review synced
     - reply draft created / reply posted / reply state changed
  -> sends an HTTP POST to your webhook URL
  -> includes signed headers
Your backend
  -> verifies the signature
  -> reads the event type + payload
  -> updates your own system
```

What you need to do

1. Build a webhook endpoint on your other website backend
- Create a backend route that accepts `POST` requests
- Example shape:
  - `/api/review-hub/webhook`
- This must be on your server/backend, not your frontend

2. Make that endpoint do 3 things
- Read the raw request body
- Read these headers:
  - `x-review-hub-event`
  - `x-review-hub-delivery`
  - `x-review-hub-timestamp`
  - `x-review-hub-signature`
- Verify the signature using the webhook signing secret

3. Add the webhook in Review Hub
- Log into the app
- Open `/integrations`
- Go to the webhook section
- Add your backend URL
- Choose the events you want
- Copy and save the signing secret immediately in your backend secrets

4. Store the signing secret in your backend
Example:
```text
REVIEW_HUB_WEBHOOK_SECRET=your_signing_secret
```

5. Handle incoming events
You currently have these event types:
- `review.created`
- `reply.status_changed`

Recommended handling:
- `review.created`
  - create/update the review in your other system
- `reply.status_changed`
  - update reply status in your other system
  - if needed, call the API to fetch fresh review/reply details

6. Keep API keys and webhooks together
Use both:
- webhook = tells your backend something changed
- API key = lets your backend fetch more data or trigger actions

Recommended flow
```text
Review Hub sends webhook
  -> your backend verifies signature
  -> your backend checks event type
  -> your backend updates local records
  -> optionally calls Review Hub API with x-api-key for full details
```

What to test first
1. Make sure your Google connection is healthy in `/integrations`
2. Create an API key and save it in your backend
3. Create one webhook endpoint
4. Trigger a sync
5. Confirm your backend receives a signed event
6. Log the payload and verify the signature before doing anything else

Minimal backend checklist
- public HTTPS webhook URL
- POST route
- raw body access
- HMAC SHA-256 signature verification
- secret stored in backend env
- 200 response when accepted
- logging for failed signature checks

Important implementation notes
- Do not expose the webhook secret or API key in browser code
- Verify the signature before trusting the payload
- Treat webhook deliveries as retry-safe; your handler should be idempotent
- Use the delivery ID header to avoid processing duplicates if needed

Best next build step
I’d implement this in your other website backend:
1. webhook receiver
2. signature verification
3. event logging
4. `review.created` sync handler
5. fallback API fetch using your Review Hub API key

Technical details
- Webhook deliveries are outbound HTTP POST requests from the backend
- Signature format is HMAC SHA-256 over:
```text
timestamp + "." + rawBody
```
- The signature arrives in:
```text
x-review-hub-signature
```
- The event name arrives in:
```text
x-review-hub-event
```
- You should compare the computed signature to the received one before parsing the event as trusted

If you want the next implementation, I would build one of these:
1. a ready-to-paste Express webhook receiver
2. a Laravel webhook receiver
3. a “Send test webhook” button in Integrations
4. automatic retries/redelivery for failed webhooks
