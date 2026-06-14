# Changelog

## 1.0.0

- Initial release.
- Scrape any Lever job board via the public `api.lever.co/v0/postings` API (single call per board, descriptions included).
- Filter by `departments` and `teams` (plain name strings, case-insensitive) before storing, so you only pay for jobs you keep.
- `daysBack` recency filter on posting creation date for incremental scheduled runs.
- `maxJobs` cap per board.
- Enhanced fields: structured `salaryRange` with regex fallback, `workplaceType`, remote/hybrid flags, location arrays.
