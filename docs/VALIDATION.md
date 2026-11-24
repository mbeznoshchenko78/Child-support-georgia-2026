# 2.0 validation record

November 24, 2026. Cases use synthetic inputs or anonymized Commission examples. The official site requires an account to create a worksheet. Reference checks replayed the mathematical functions shipped publicly by the Commission. No live authenticated worksheet or court-issued order was generated.

| Check | Result |
| --- | --- |
| Independent signed Act, Commission PDF, official public client and app tables | All 4,710 BCSO values, 220 low-income dollar values, 74 blank cells, six rates and six thresholds agree. |
| Public-client lookup replay | 18,858 BCSO and 5,490 low-income comparisons agreed in the public-client comparison mode. |
| Named Node tests | 1,027 passed. Coverage includes every table row and six columns, calculation and calendar boundaries, hand calculations, saved scenarios, import validation, historical ledger, planning models, signed outcomes and CSP integrity. |
| Commission worked examples | Parenting adjustment $255.46 and line 10 $414.11. Low-income worksheet B line 10 $244.15, capped to $239.69. Both reproduced. |
| Pinned official worksheet scenarios | 45 fixture cases. 42 in scope compared both parents’ key lines and the signed transfer, 3 checked explicit scope guards. Five intentional statutory-first outcomes differ from the public-client calculation. |
| Additional seeded worksheet comparisons | 600 mixed synthetic cases, both named parents as NCP, 1–6 children, fractional days, Schedule B, two payers, extraordinary costs, reversals and credits. Both parents’ checked lines and all 600 whole-dollar amounts and payment directions matched the public payment-summary text in public-client mode. The sweep uncovered three cent-level discrepancies and three additional one-dollar discrepancies from prematurely rounding Schedule E. All six were corrected. |
| Reproducible standalone build | Source rebuild and script integrity check passed. |

## Browser and PDF review

The browser suite uses the real standalone HTML at a simulated GitHub Pages subpath and as a downloaded file. It runs in a fresh browser profile, records page errors and rejects unexpected outgoing network requests. Scenarios cover exact and slider inputs, blocked incomplete drafts, comparison curves and heatmaps, both parenting calendars, saved records, invalid imports, financial privacy, payment receipts and print output.

The release check exercises a 1440-pixel desktop and iPhone-style touch viewports at 430 and 375 CSS pixels. Review included visual inspection of all three workspaces and the five-page US Letter printout. Narrow-screen testing exposed a WebKit navigation overflow. Printing exposed a nearly empty continuation page and unconfigured plans that initially looked like full-year calendars. The release includes corrections for all three issues. These are browser-engine and device-emulation checks. A physical iPhone print-and-share session and a live authenticated official worksheet are separate outstanding checks.

The [sample report](example-report.pdf) was generated in Chromium using the public Commission worked example. Its five pages cover the summary, financial schedules, worksheet audit, parenting plans and findings, and supporting record. Real inputs may produce more pages. PDF text extraction confirmed headings and the reported amounts. The default report distinguishes the manual 245/120 day entry from calendars with no rules entered.

## Repeat the external comparisons

```sh
curl -fLsS https://gov.georgia.gov/document/2024-signed-legislation/sb-454/download -o /tmp/ga-act.pdf
curl -fLsS https://csc.georgiacourts.gov/wp-content/uploads/2026/01/O.C.G.A.-_-19-6-15_01.01.2026.pdf -o /tmp/ga-statute.pdf
curl -fLsS https://csconlinecalc.georgiacourts.gov/static/js/main.56d6114c.js -o /tmp/ga-public.js
python scripts/verify-tables.py --act /tmp/ga-act.pdf --commission /tmp/ga-statute.pdf --client /tmp/ga-public.js
node scripts/compare-table-client.mjs /tmp/ga-public.js
node scripts/official-reference.mjs /tmp/ga-public.js test/fixtures/official-inputs.json > /tmp/reference.json
cmp test/fixtures/official-results.json /tmp/reference.json
node scripts/sweep-worksheet.mjs /tmp/ga-public.js
```

The replay verifies the bundle’s SHA-256 before evaluating the published arithmetic in an isolated offline context. The official application, login, HTTP and persistence are excluded. No Commission JavaScript is shipped in the app. The two independent source PDFs and their checksums are documented in [the table record](TABLES.md).

## Open validation and future improvements

1. Obtain anonymized, finalized official PDFs for reversal, terminal-income and mixed low-income/deviation cases. Reconcile printed payer wording, cent-level display and the statutory-first sequence with a Georgia family-law reviewer. Published browser code and worked examples establish a narrower scope than full filing-system parity.
2. The calculator handles two parents and one common custodial situation for 1–6 children. For split custody, create separate scenarios/official worksheets. Nonparent custodians, seven or more children, undefined shares at zero combined income, and incompatible residence/order entries are flagged. Future expansion should begin with official fixtures for those situations.
3. Actual business income, allowable expenses, equity valuation, imputation, extraordinary medical hardship, the day-count method, deviation findings and retroactive eligibility depend on evidence or judicial determination. Exact effective dates, reimbursements and preexisting-order allocation should be checked for each case. Review future Commission releases, new legislation, and next year’s self-employment wage base before carrying this ruleset forward.
