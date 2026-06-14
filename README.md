# Lever Job Scraper & API

[![Apify Actor](https://img.shields.io/badge/Apify-Actor-blue)](https://apify.com/dalleyne/lever-job-scraper)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Scrape Lever ATS job boards via API and get clean, structured job data with **department and team filtering applied before anything is stored**. Pull live roles from thousands of Lever-hosted career sites. No browser, no HTML parsing, 100% open source. Built for job boards, AI agents, and hiring research.

## What can Lever Job Scraper & API do?

- ✅ Scrape job listings from any Lever job board
- ✅ **Filter by department and team before storing**, so you only pay for jobs you keep
- ✅ **Filter by recency** (`daysBack`) for scheduled, incremental scraping
- ✅ **Limit results** per board with `maxJobs`
- ✅ Department and team are plain names, so **no ID lookup** is required
- ✅ Enhanced fields: structured salary range with regex fallback, `workplaceType`, remote/hybrid detection, location arrays
- ✅ Export data in JSON, CSV, XML, Excel, or HTML
- ✅ 100% open source (MIT). Audit the code on [GitHub](https://github.com/d-alleyne/lever-job-scraper)

## Why filtering before storing saves you money

Most Lever scrapers fetch every job on a board and leave the filtering to you. You pay for Sales, HR, and Support listings you never wanted.

This actor filters by department and team first. A typical mid-size board lists 200+ jobs across all departments. If you only want Engineering:

| Approach | Jobs stored | Cost per board |
|----------|------------|----------------|
| Fetch-everything scraper at $0.99/1,000 | 200 | ~$0.20, plus your own filtering work |
| This scraper at $2.00/1,000 with `departments` set | ~20 | ~$0.04, already clean |

The headline price is higher. The cost per **relevant** job is typically 5 to 15 times lower, and your dataset arrives ready to use.

## Pricing

**$2.00 per 1,000 results**, pay per event. You are only charged for jobs that survive your filters, not for everything the board lists.

- 50 jobs = $0.10
- 500 jobs = $1.00
- 5,000 jobs = $10.00

## Input

### Simple Example

```json
{
  "urls": [
    { "url": "https://jobs.lever.co/anchorage" },
    { "url": "https://jobs.lever.co/mistral" }
  ]
}
```

### With Filters (Per-Board)

Each URL can have its own filters:

```json
{
  "urls": [
    {
      "url": "https://jobs.lever.co/anchorage",
      "departments": ["Engineering"],
      "teams": ["Blockchain"],
      "maxJobs": 20,
      "daysBack": 7
    },
    {
      "url": "https://jobs.lever.co/mistral",
      "maxJobs": 10
    }
  ]
}
```

### Parameters

- **urls** (required): Array of job board configurations. Each entry can be a plain URL string or an object supporting:
  - `url` (required): Clean Lever job board URL, e.g. `https://jobs.lever.co/anchorage` (the EU host `jobs.eu.lever.co` also works)
  - `departments` (optional): Array of department name strings to keep (case-insensitive), e.g. `["Engineering", "Product"]`
  - `teams` (optional): Array of team name strings to keep (case-insensitive), e.g. `["Backend"]`
  - `maxJobs` (optional): Maximum number of jobs to store from this board
  - `daysBack` (optional): Only store jobs created in the last N days, e.g. `7` for last week

Department and team filters combine with AND: a job is kept only if it matches an entry in **every** filter you set. Leave a filter out to keep everything on that dimension.

### How to find department and team names

Lever uses plain text names, not IDs, so there is nothing to look up. Open the company's Lever board (e.g. `https://jobs.lever.co/anchorage`), read the department or team label shown on each posting, and use that exact text (case does not matter). You can also list every available value by running the actor once with no filters and inspecting the `department` and `team` fields in the output.

### Scheduled Runs

Keeping a board fresh is two parts that work together:

1. **A Schedule sets *when* the actor runs.** In Apify Console, open **Schedules → Create new**, add this actor (or a saved task with your input), and give it a cron expression. Weekly Monday 6am is `0 6 * * 1`; Monday and Thursday is `0 6 * * 1,4`. The schedule is what makes runs recur — the input JSON alone does not.
2. **`daysBack` sets *how far back* each run looks**, filtering jobs by their creation date. Match it to your cron cadence so each run picks up everything new since the last one without re-storing old jobs: a weekly cron pairs with `daysBack: 7`, a twice-weekly cron with `daysBack: 4`. You only pay for jobs that pass the filter.

**Input for a weekly schedule (`0 6 * * 1`):**
```json
{
  "urls": [
    {
      "url": "https://jobs.lever.co/anchorage",
      "departments": ["Engineering"],
      "daysBack": 7
    }
  ]
}
```

Tip: set `daysBack` one or two days longer than your cron gap (e.g. `daysBack: 9` on a weekly cron) so a delayed or skipped run doesn't leave a gap in coverage. Duplicates across runs are possible if a job's creation date falls in two overlapping windows — dedupe on the `id` field downstream.

## Output

Each job listing includes:

```json
{
  "id": "abc12345-6789-...",
  "company": "example",
  "type": "Full-time",
  "title": "Senior Backend Engineer",
  "description": "<p>Job description HTML...</p>",
  "descriptionPlain": "Job description plain text...",

  "location": "Remote",
  "locations": ["Remote", "San Francisco"],
  "workplaceType": "remote",
  "isRemote": true,
  "isHybrid": false,

  "salary": {
    "min": 120000,
    "max": 160000,
    "currency": "USD",
    "interval": "per-year-salary",
    "raw": "USD120000-160000"
  },

  "department": "Engineering",
  "team": "Backend",
  "country": "US",

  "metadata": {
    "commitment": "Full-time",
    "department": "Engineering",
    "team": "Backend"
  },

  "postingUrl": "https://jobs.lever.co/anchorage/abc12345-6789-...",
  "applyUrl": "https://jobs.lever.co/anchorage/abc12345-6789-.../apply",
  "publishedAt": "2026-05-07T01:08:03.000Z"
}
```

### Field Descriptions

**Basic fields** (always extracted):
- `id`, `title`, `company`, `department`, `team`, `postingUrl`, `applyUrl`, `publishedAt`

**Enhanced fields** (parsed from data):
- `location` (string) - Primary location text from Lever
- `locations` (array) - All locations Lever lists for the posting
- `workplaceType` (string) - Lever's own value: `remote`, `on-site`, `hybrid`, or `unspecified`
- `isRemote` / `isHybrid` (boolean) - Derived from `workplaceType` and location text
- `salary` (object|null) - Lever's structured `salaryRange` when present, otherwise a regex extraction from the description
- `country` (string|null) - Country code Lever associates with the posting

**For LLM enhancement** (recommended downstream post-processing):
- `description` - Full HTML description for extracting tech stack, detailed requirements, timezone restrictions
- `descriptionPlain` - Plain-text version for cheaper token usage
- `salary` - May be null if no structured range and the description has no simple pattern; parse `description` for complex cases

## Use it with AI agents

This actor works as a tool for AI agents through the [Apify MCP server](https://mcp.apify.com). Connect your agent (Claude, or any MCP-compatible framework) to the Apify MCP server and it can discover and call `dalleyne/lever-job-scraper` with the same JSON input shown above. The input schema is deliberately small (one `urls` array), which keeps agent tool calls reliable.

Typical agent patterns:
- Career chatbots that answer "who is hiring backend engineers on Lever boards this week?"
- Talent-market research pipelines that track posting volume by department
- Job board back ends that refresh listings on a schedule without scraping infrastructure

## Is it legal to scrape Lever job listings?

This actor reads public job postings through Lever's official public postings API, the same data anyone can see in a browser without logging in. It collects no personal data. You are responsible for how you use the data; if in doubt, review Lever's terms and the rules that apply to your use case.

## How It Works

1. Parses Lever job board URLs and extracts the site token (e.g. "example")
2. Fetches all postings in one call via Lever's public API: `https://api.lever.co/v0/postings/{site}?mode=json`
3. Filters by department and team names if specified, before anything is stored
4. Applies the `daysBack` recency filter and `maxJobs` cap
5. Parses enhanced fields (salary, location array, remote/hybrid flags)
6. Saves results to the dataset

## Usage via API

```bash
curl -X POST https://api.apify.com/v2/acts/dalleyne~lever-job-scraper/runs \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      {
        "url": "https://jobs.lever.co/anchorage",
        "departments": ["Engineering"]
      }
    ]
  }'
```

## Run It Locally (Open Source)

The full source is on [GitHub](https://github.com/d-alleyne/lever-job-scraper):

```bash
# Install dependencies
npm install

# Set up local Apify storage
export APIFY_LOCAL_STORAGE_DIR=./apify_storage

# Create input file
mkdir -p ./apify_storage/key_value_stores/default
echo '{"urls":[{"url":"https://jobs.lever.co/anchorage","departments":["Engineering"]}]}' > ./apify_storage/key_value_stores/default/INPUT.json

# Run the actor
npm start

# Check results
cat ./apify_storage/datasets/default/*.json
```

## FAQ

### How much does a typical run cost?

A scheduled run pulling new engineering jobs from 6 companies typically stores 10 to 50 jobs, which costs $0.02 to $0.10. Because filtering happens before storage, board size doesn't drive your bill. Job relevance does.

### How do I keep a job board updated automatically?

Create a Schedule in Apify Console pointing at this actor, and set `daysBack` to match your cadence (7 for weekly, 4 for twice-weekly). Each run then only stores and charges for jobs created since your last window.

### Do I need to look up department or team IDs?

No. Lever exposes plain text names, so you use the department or team label as shown on the board. Run once with no filters to see every available value in the output.

### What if a salary isn't extracted?

Lever's structured `salaryRange` is used when the company fills it in. Otherwise the built-in parser catches range patterns in common currency symbols (e.g. `$110,000 - $120,000`, `£50k - £70k`). Narrative compensation text is left in `description` for you to parse downstream with an LLM.

### Can AI agents run this actor?

Yes. It's callable through the Apify MCP server like any store actor, and the single-array input schema keeps tool calls simple. See [Use it with AI agents](#use-it-with-ai-agents).

## Changelog

See [CHANGELOG.md](https://github.com/d-alleyne/lever-job-scraper/blob/main/CHANGELOG.md).

## Related Scrapers

Looking for other ATS platforms?

- **[Greenhouse Job Scraper & API](https://apify.com/dalleyne/greenhouse-job-scraper)** - Scrape Greenhouse job boards (Automattic, GitLab, etc.) with department filtering
- **[Ashby Job Scraper & API](https://apify.com/dalleyne/ashby-job-scraper)** - Scrape Ashby job boards (Buffer, Zapier, RevenueCat, etc.) with team filtering and applicant location requirements

## Found this useful?

If this actor saves you money or time, a review on the store page helps other people find it. It takes 30 seconds and makes a real difference for independent developers.

## License

MIT

## Author

Built by [Damien Alleyne](https://alleyne.dev)
