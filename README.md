# Georgia Support Studio 2.0

A private, offline-capable Georgia child support calculator, scenario laboratory and hearing-preparation workspace. The 2.0 review branch can be tested independently of the existing GitHub Pages site.

**Try it immediately.** Download the branch’s [index.html](index.html) and open it in a modern browser. It contains the whole app, including both statutory tables, all visualizations, calendars and the print report. There are no runtime dependencies. Saved scenarios stay on the device where they were saved. From a checkout you can also serve the directory with `python -m http.server 8000` and open `http://localhost:8000`.

## Workspaces

| Mode | What it covers |
| --- | --- |
| Calculator | One to six children, both parents’ compensation, adjusted incomes, fractional parenting days, child-only health premiums, work-related care, deviations, benefits and an itemized calculation audit. |
| Analysis lab | Income and parenting-time sensitivity, signed monthly transfers, two-dimensional what-if analysis, saved-scenario comparisons, current-order changes, optional high-income projections and independent negotiated outcomes. |
| Court prep | Current/proposed two-year calendars, dated payment modeling, evidence and findings, source references and print-to-PDF reports for attorney discussion. |

The initial anonymized inputs reproduce the Commission’s published January 2026 parenting-time example. For this example, line 10 is **$414.11** and the rounded transfer is **$414/month from Parent B to Parent A**. Change inputs freely. Saving is an explicit action.

## Review materials

- [User guide](docs/GUIDE.md)
- [Statutory method, rounding and scope](docs/METHOD.md)
- [Enacted and Commission table comparison](docs/TABLES.md)
- [Release validation and remaining uncertainties](docs/VALIDATION.md)
- [Changes since the published estimator](CHANGELOG.md)
- [Deployment and rollback](docs/RELEASE.md)

## Development and QA

```sh
npm run build
npm run check
npm test
```

Use Node.js 20 or newer. The build bundles the local modules and stylesheet into the checked-in standalone HTML and computes its script hash for the content security policy. It never requests external assets. The normal unit suite runs offline. For real-browser tests, install Python Playwright, its browser and platform prerequisites. Run `python test/browser_qa.py` or `GA_TEST_BROWSER=webkit python test/browser_qa.py`. Public-source parity checks are documented in the validation report.

## Court use

Use the Georgia Child Support Commission’s calculator, worksheet and applicable schedules for filings. This app is for planning and preparing information for an attorney. It does not provide legal advice or create a court order. [Official calculator](https://csconlinecalc.georgiacourts.gov/) · [Georgia Courts](https://georgiacourts.gov/child-support-calculator/) · [Disclaimer](DISCLAIMER.md)

[MIT License](LICENSE)
