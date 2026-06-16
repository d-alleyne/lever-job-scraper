# Changelog

## 1.1.2

- Work model (`isRemote`/`isHybrid`) now also reads Lever's `commitment` field (e.g. "Full-Time - Hybrid"), not just `workplaceType` and location, for more accurate remote/hybrid classification.

## 1.1.1

- Salary parser no longer multiplies bare sub-1000 numbers by 1000; the ×1000 scaling applies only when the amount carries a `k`.
- Salary object always includes `interval` (null on the regex path) and coerces structured `min`/`max` to numbers, for a stable shape.
- Salary regex reads the plain-text salary blurb or plain description only, never raw HTML.
- `daysBack` excludes jobs with a missing or invalid `createdAt`, and accepts a stringified value (e.g. `"7"`).
- `publishedAt` is guarded against invalid dates instead of throwing and aborting the board.
- Non-array API responses raise a clear error instead of silently looking like an empty board.
- All requests have a 30-second timeout; the run fails if every board errors and nothing is stored.

## 1.1.0

- Capture Lever's free-text compensation field as `salaryDescription` (`salaryDescriptionPlain`), preserved verbatim for salary-transparency listings.
- Improve salary parsing: when there is no structured `salaryRange`, the regex now reads the dedicated salary blurb before the full job description.

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
