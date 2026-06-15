# Changelog

## 1.0.1

- Add an actor icon (lever motif, matching the Greenhouse and Ashby scrapers).
- Prefill now includes a full-feature example object (`departments`, `teams`, `maxJobs`, `daysBack`) so you can copy and adjust it without reading the README.
- Use real example boards (Anchorage, Mistral) in the README and input schema.

## 1.0.0

- Initial release.
- Scrape any Lever job board via the public `api.lever.co/v0/postings` API (single call per board, descriptions included).
- Filter by `departments` and `teams` (plain name strings, case-insensitive) before storing, so you only pay for jobs you keep.
- `daysBack` recency filter on posting creation date for incremental scheduled runs.
- `maxJobs` cap per board.
- Enhanced fields: structured `salaryRange` with regex fallback, `workplaceType`, remote/hybrid flags, location arrays.
