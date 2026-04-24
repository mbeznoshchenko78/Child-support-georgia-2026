# Georgia Child Support 2026 Estimate Calculator

A lightweight, browser-based planning calculator for simplified Georgia child support estimates.

## Live Demo

Use the live app here:

[Open Georgia Child Support Calculator](https://mbeznoshchenko78.github.io/Child-support-georgia-2026/)

## What It Does

This calculator provides a simplified monthly child support estimate for common Georgia child support planning scenarios.

Current supported inputs:

- 1, 2, or 3 children
- Parent A monthly income
- Parent B monthly income
- Parenting time split totaling 365 days
- Child-related health insurance premium
- Which parent pays the child-related health insurance premium

The calculator shows:

- the primary official-style Georgia CSWS result using the BCSO table capped at $40,000 combined monthly income
- a separate optional high-income planning scenario when combined monthly income exceeds $40,000
- pro rata income shares
- pro rata child-related health insurance split
- custodial / non-custodial parent labels based on parenting days
- a detailed explanation of the calculation steps and assumptions

## Important Limitations

This app is a planning tool only. It is not the official Georgia Child Support Commission calculator and does not generate a court-ready worksheet.

The simplified calculator currently excludes:

- low-income adjustment
- self-employment adjustment
- preexisting support order adjustment
- qualified-children adjustment
- work-related child care expenses
- extraordinary expenses
- discretionary deviations
- taxes, filing status, or other case-specific legal issues

For court filings or litigation use, verify all numbers with the official Georgia Child Support Calculator and, when appropriate, legal counsel.

## High-Income Planning Scenario

Georgia's official Basic Child Support Obligation table is capped at $40,000 combined monthly income. This app shows the official capped result first.

If combined monthly income exceeds $40,000, the app may also show an optional high-income planning scenario using an extrapolated BCSO amount up to $80,000 combined monthly income.

That extrapolated scenario is not an official worksheet amount. It is included only as a planning reference for possible high-income deviation analysis.

## Privacy

This tool runs entirely in your browser.

No information is submitted, stored, or shared by the app.

## Tech

Static GitHub Pages app using:

- `index.html`
- `styles.css`
- `app.js`

No build step or server is required.

## License

This project is released under the MIT License. See [LICENSE](LICENSE).

## Disclaimer

See [DISCLAIMER.md](DISCLAIMER.md).
