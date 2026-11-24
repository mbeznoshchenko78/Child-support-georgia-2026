# 2.0 review release · November 24, 2026

| Area | Published 1.0 | 2.0 review branch |
| --- | --- | --- |
| Basic obligation | 32 selected income rows, interpolation between anchors, 1–3 children | All 785 enacted rows and six columns. Explicit nearest row, upper/lower boundaries, actual adjusted incomes retained. |
| Income range | Individual monthly input silently constrained to $3,000–$40,000 | Zero and high individual income accepted. Invalid or unsupported inputs produce an actionable state. The real table ceiling applies to combined adjusted income. |
| Income and expenses | Monthly income and one insurance payer | Monthly/annual wages and detailed compensation, Schedule B adjustments, both payers’ health/care, distinct E proposals, future reimbursements and derivative benefit credits. |
| Parenting | Whole-day slider | Fractional annual days, tie rules based on gross income, no-order case, distinct residence and per-child counts, dated and recurring two-year calendars. |
| Outcomes | Estimate and extrapolated BCSO planning result | Presumptive line 10, guideline baseline, proposed deviations, explicit zero/reversal, low-income comparison, separately parameterized high-income and negotiated outcomes. |
| Scenario analysis | One live input set | Income/time curves, directional heatmaps, explicit cell application, current-order and multiple-scenario comparisons, local import/export and clearing. |
| Court preparation | Calculation explanation | Schedules A–E record, findings and checklist, existing/proposed plans, dated payment budget, printable attorney discussion report. |
| Delivery | Three static assets | Source modules, deterministic single-file offline build, named automated tests and independent source replay. Static GitHub Pages remains supported. |

The original release remains available in Git history at `f7567493808f02f1128b29a63af0a380af7cd5a9`. Version 1 stored no scenarios, so there is no 1.0 saved-data migration.
