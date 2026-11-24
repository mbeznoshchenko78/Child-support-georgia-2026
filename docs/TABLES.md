# Georgia support tables and independent lookup validation

**Research date · November 24, 2026.** The July 2024 Basic Child Support Obligation (BCSO) schedule and January 2026 low-income schedule are stored as integer dollars. A separate fixture preserves the Commission’s printed rows and blank cells. [Runtime tables](../src/tables.mjs) · [Commission fixture in CSV format](../test/fixtures/statutory-tables.csv)

## Legal sources

| Authority | What it establishes |
| --- | --- |
| [Governor’s signed SB 454, Act 618 (2024)](https://gov.georgia.gov/document/2024-signed-legislation/sb-454/download) | The replacement BCSO occupies numbered lines 1727–2511 on pages 67–95. The earlier table printed in the bill is struck out. The percentage and dollar rows of the low-income table occupy lines 2518–2568 on pages 96–97. Section 2 sets the effective dates. |
| [Commission’s effective January 1, 2026 statute PDF](https://csc.georgiacourts.gov/wp-content/uploads/2026/01/O.C.G.A.-_-19-6-15_01.01.2026.pdf) | O.C.G.A. § 19-6-15(b)(3)–(5), (i)(2)(A), (i.1), (o), and (p). The BCSO appears on PDF pages 21–59. The low-income table begins on page 60 and its data continue through page 63. |
| [Commission guidance on SB 454](https://csc.georgiacourts.gov/2024-updates-to-the-child-support-guidelines/) | The current BCSO applies to worksheets created on or after July 1, 2024. The Commission cautions against using its discontinued Excel product for current tables. Current parenting-time and low-income adjustments took effect January 1, 2026. |
| [Governor’s signed HB 1268 (2026)](https://gov.georgia.gov/document/2026-signed-legislation/hb-1268/download) | Section 19(1), lines 110–114, supplies a closing quotation mark in § 19-6-15(a)(17). The dollar tables and calculation rules in SB 454 continue to apply. |
| [Commission meeting summary dated October 30, 2026](https://csc.georgiacourts.gov/wp-content/uploads/2026/11/10_30_26-Summary.pdf) | Moving dental/vision premiums to Schedule D and removing the special-expense 7% test were proposals for a future legislative session. |
| [Official calculator](https://csconlinecalc.georgiacourts.gov/) · [public release used for comparison](https://csconlinecalc.georgiacourts.gov/static/js/main.56d6114c.js) | The browser release exposed its two table lookups and their reference data publicly. The comparison ran these functions locally with synthetic inputs. Authenticated worksheet generation and printed court forms are outside this comparison. |

## How the lookup works

**Basic obligation.** Add both parents’ monthly adjusted incomes. Select the closest published row and look up the relevant child-count column. There are 785 rows from $800 to $40,000 in $50 steps and six child-count columns, for 4,710 published amounts. When the monthly income is exactly between two rows, the public calculator takes the upper row. For example, $5,024.99 selects $5,000, and $5,025 selects $5,050. Section (b)(4) gives the nearest-row rule and leaves the equidistant case unspecified.

Use the $800 row below the bottom of the table. Above $40,000, § (i)(2)(A) directs use of the largest published BCSO for the applicable child count. A court may grant a separate upward deviation. In either situation, retain the actual incomes for the parents’ pro rata shares. Both actual monthly income and the selected table income are returned by the lookup.

**Low-income adjustment.** Use the individual parent’s monthly adjusted income and the applicable child-count column. A qualifying parent pays the lesser relevant obligation under § (i.1). For income up to and including $1,500 the amount is a percentage of actual income. Above $1,500 the table contains 49 dollar rows at $50 intervals, with 220 published amounts and 74 blank cells. Blank cells stay empty. The first dollar row is $1,550. The public client uses this row for income just above $1,500, then uses the nearest dollar row. A tie goes to the lower row. For two children, $1,500 gives $360, $1,500.01 and $1,575 give $372, and $1,575.01 gives $389. These choices match the observed public implementation.

| Children | At or below $1,500 | Terminal monthly adjusted income | Last dollar amount |
| ---: | ---: | ---: | ---: |
| 1 | 19% | $2,450 | $467 |
| 2 | 24% | $2,950 | $840 |
| 3 | 25% | $3,350 | $1,142 |
| 4 | 26% | $3,550 | $1,343 |
| 5 | 27% | $3,750 | $1,556 |
| 6 | 28% | $3,950 | $1,774 |

**Terminal-income difference.** Section (i.1) uses a strict “less than” condition. At exactly $2,450 with one child and a $500 obligation before the adjustment, the statutory lookup therefore leaves $500 in place. The public client includes the terminal row and would limit the same input to $467. The default lookup follows the statutory threshold. An expressly selected official-client comparison includes the terminal row. Incomes just below the terminal amount can use that row as their nearest match.

**Ordering.** Subsections (b)(7) and (8) order deviations and then the low-income adjustment. The current public worksheet displays the adjusted subtotal on line 11, followed by deviations on line 12. The order can change a proposed award. The table functions return the applicable cap so each method can apply it at its own stage.

**Families with seven or more children.** The statute publishes six columns. The lookup reports the full count and the use of column six. The public client uses the sixth column at $800 or above for additional children. There is one reproducible exception below $800. The client returns the first-column value of $170 for seven children there, then returns $417 when the income reaches $800. The table helper uses the sixth-column value of $417 consistently. Seek official worksheet and legal confirmation for such families.

## Reproduce the checks

The ordinary test suite uses the independent CSV fixture and requires only Node.js. It checks all six amounts at every BCSO row, both sides of every midpoint, every low-income cell and eligibility threshold, and rejected inputs.

```sh
node --test test/tables.test.mjs
```

A source audit requires Python 3, Node.js, Poppler’s `pdftotext` and access to the three public source files. With no arguments the command downloads the pinned materials into a temporary directory. To run offline, pass their local paths using `--act`, `--commission` and `--client`. The optional `--write` switch refreshes the runtime rows from the Act and the test CSV from the Commission printing after validation.

```sh
python3 scripts/verify-tables.py
node scripts/compare-table-client.mjs /path/to/main.56d6114c.js
```

The second command evaluates only the public release’s two table functions and their data against synthetic inputs. Download that release from the official link in the source table. The comparison scripts require matching source hashes. The browser app exclusively uses its local table module.

| Material | SHA-256 |
| --- | --- |
| Governor’s signed SB 454 PDF | `240e0a24ef8321b51d573e7014771f75fa87e150dcabc87bb073e97a5e3ae23f` |
| Commission January 2026 statute PDF | `7167414db755b416467dbd93f3505d0e2c48d0f454234dce9bcf127098a931c8` |
| Official calculator JavaScript release | `99ad24cf1793e45cbc67d4cff1859b4c7261955ffd867521ff171431a7e53303` |

## Recorded results

Run on November 24, 2026 with synthetic inputs.

| Check | Result |
| --- | --- |
| Signed law, Commission printing, public calculator data and bundled local tables | All 4,710 BCSO amounts, 220 low-income dollar amounts, 74 empty cells, six rates and six terminal incomes agreed. |
| Ordinary offline table tests | 844 passed, zero failed or skipped. Each income-row test covers all six columns. |
| Direct BCSO lookup comparison against the public client’s function | All 18,858 combinations agreed, including every midpoint for one through six children. |
| Direct low-income cap comparisons against the public client’s function | All 5,490 synthetic combinations agreed in official-client mode. Inputs included three different starting obligations and fractional incomes near row boundaries. |
| Explicit difference probes | All six exact terminal incomes differed under the statutory and public-client boundary conventions as documented. The public client’s below-$800 result for a seventh child was reproduced. |

This evidence establishes the table data and lookup behaviors checked here. Other worksheet stages, official saved worksheets, and fact-dependent court findings require their own validation.
