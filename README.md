# Georgia Child Support 2026 Estimate Calculator

Single-page planning calculator for supported Georgia child support case types (1-2 children, CP/NCP, Schedule B/C/D flow, limited deviations, low-income adjustment).

## Run

Open `index.html` in a local static server (required to fetch JSON data):

```bash
python3 -m http.server 8080
```

Then open <http://localhost:8080>.

## Testing

```bash
node --test tests/calc.test.js
```

## Notes

- Planning estimate only; not legal advice.
- Not the official Georgia worksheet generator.
