# DC Ban List Worker

Cloudflare Worker modules for the existing ban log API, archive UI, and a daily incremental crawl of DCInside's PC management/block page.

## Configure

1. Replace the D1 and KV placeholder IDs in `wrangler.jsonc` with the existing resources.
2. Set `GALLERIES_JSON`, for example:

   ```json
   [{"id":"onshinproject","path":"mgallery"}]
   ```

   `path` may be `mgallery`, `gallery`, or `mini` and determines the management URL path segment.
3. Add secrets without putting credentials in source control:

   ```powershell
   npx wrangler secret put VIEW_TOKEN
   npx wrangler secret put INGEST_TOKEN
   npx wrangler secret put ADMIN_TOKEN
   npx wrangler secret put DC_USER_ID
   npx wrangler secret put DC_PASSWORD
   ```

4. Install dependencies and deploy:

   ```powershell
   npm install
   npm run deploy
   ```

The cron is `17 20 * * *` UTC (05:17 KST). Change it in `wrangler.jsonc` if needed.

## Crawl behavior

- Reads page 1 first and compares records against D1's newest row using the same seven fields as the Java app.
- Stops at the first exact field match, then writes only newly observed rows.
- If no stored latest row exists, imports page 1 only as the initial baseline; it intentionally does not backfill old pages.
- If the latest row is not found within the page cap, or login/fetch/parsing fails, no partial rows are ingested. The KV status is set to `failed` and the previous snapshot remains intact.
- Successful D1 ingestion rebuilds the existing `snapshot` KV key. `refresh-status` stores progress/result separately.
- The crawl page cap is deliberately conservative and configurable through `MAX_CRAWL_PAGES`.

The login flow fetches the current sign-in page to obtain `ci_t`, then posts the configured credentials. DCInside may change its login flow or require additional verification; in that case the status endpoint will report the crawl failure without modifying the current snapshot.

## Existing routes

The prior UI, `/data.json`, `/admin/verify`, `/admin/delete`, `/refresh`, and app actions (`ingest`, `getLatestData`, `searchIdentifier`) remain available. `GET /refresh-status.json?token=...` returns the latest crawl status.
