#!/usr/bin/env python3
"""Compare both official PDF printings, the public Georgia calculator, and the local tables.

Python 3, Node.js, and Poppler's pdftotext are required. By default, official files
are downloaded to a temporary directory. Local copies can be supplied individually.
--write refreshes the runtime data and the independent CSV fixture after source parity.
"""
import argparse
import csv
import hashlib
import io
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
MODULE = ROOT / "src/tables.mjs"
FIXTURE = ROOT / "test/fixtures/statutory-tables.csv"
SOURCES = {
    "act": (
        "https://gov.georgia.gov/document/2024-signed-legislation/sb-454/download",
        "240e0a24ef8321b51d573e7014771f75fa87e150dcabc87bb073e97a5e3ae23f",
    ),
    "commission": (
        "https://csc.georgiacourts.gov/wp-content/uploads/2026/01/O.C.G.A.-_-19-6-15_01.01.2026.pdf",
        "7167414db755b416467dbd93f3505d0e2c48d0f454234dce9bcf127098a931c8",
    ),
    "client": (
        "https://csconlinecalc.georgiacourts.gov/static/js/main.56d6114c.js",
        "99ad24cf1793e45cbc67d4cff1859b4c7261955ffd867521ff171431a7e53303",
    ),
}
COLUMNS = ("adjusted", "one_child", "two_children", "three_children", "four_children", "five_children", "six_children")
LOW_RATES = [19, 24, 25, 26, 27, 28]
MONEY = re.compile(r"(?<![\d,])[\d,]+\.00(?!\d)")


def verify_equal(label, actual, expected):
    if actual == expected:
        return
    if isinstance(actual, list) and isinstance(expected, list):
        for index, pair in enumerate(zip(actual, expected)):
            if pair[0] != pair[1]:
                raise ValueError(f"{label} differs at row {index + 1}: {pair[0]} versus {pair[1]}")
    raise ValueError(f"{label} differs")


def read_source(name, local_arg, temp):
    url, expected_hash = SOURCES[name]
    if local_arg:
        path = Path(local_arg)
    else:
        path = temp / name
        with urllib.request.urlopen(url, timeout=60) as response:
            path.write_bytes(response.read())
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if digest != expected_hash:
        raise ValueError(f"{name} SHA-256 changed. Expected {expected_hash}, received {digest}. Review the new authority before updating.")
    return path


def pdf_text(path):
    return subprocess.check_output(["pdftotext", "-layout", str(path), "-"], text=True)


def ordered_rows(lines, *, allow_blanks):
    result = []
    for line in lines:
        values = [int(match.replace(",", "")[:-3]) for match in MONEY.findall(line)]
        if not values:
            continue
        if not 2 <= len(values) <= 7 or (not allow_blanks and len(values) != 7):
            raise ValueError(f"Invalid table row in source PDF: {line}")
        # All missing §(p) dollar cells are contiguous from the one-child column.
        # The third (public client) comparison verifies the explicit column keys.
        result.append([values[0], *[None] * (7 - len(values)), *values[1:]])
    return result


def act_rows(text):
    # SB 454 also prints the struck-out, pre-2024 schedule. Use the numbered
    # lines for the ENACTED replacement instead of the first matching header.
    lines = {int(m[1]): m[2] for m in re.finditer(r"^\s*(\d{4})[ \t]+([^\n]+)$", text, re.M)}
    rates = list(map(int, re.findall(r"(\d+)%", lines[2518])))
    verify_equal("enacted percentage row", rates, LOW_RATES)
    if "1500" not in lines[2519]:
        raise ValueError("Unexpected percentage threshold in enacted row.")
    return (ordered_rows([lines[i] for i in range(1727, 2512)], allow_blanks=False),
            ordered_rows([lines[i] for i in range(2520, 2569)], allow_blanks=True))


def commission_rows(text):
    start = text.index("(o) Basic Child Support Obligation Table.")
    low = text.index("(p) Low-income Adjustment Table.", start)
    end = text.index("(q) The child support guidelines", low)
    rates = list(map(int, re.findall(r"(\d+)%", text[low:end])))
    verify_equal("Commission percentage rows", rates, LOW_RATES * 3)
    return (ordered_rows(text[start:low].splitlines(), allow_blanks=False),
            ordered_rows(text[low:end].splitlines(), allow_blanks=True))


def client_table(text, first_token):
    start = text.index(first_token)
    end = text.index("]", start)
    result = []
    for row in re.findall(r"\{([^}]+)\}", text[start:end]):
        cells = dict(re.findall(r'(\w+):"([^"]*)"', row))
        result.append([int(float(cells[k].replace(",", ""))) if cells.get(k) else None for k in COLUMNS])
    return result


def fixture_text(tables):
    output = io.StringIO()
    writer = csv.writer(output, lineterminator="\n")
    writer.writerow(["table", *COLUMNS])
    for title, rows in zip(("BCSO", "LOW_INCOME"), tables):
        for row in rows:
            writer.writerow([title, *row])
    return output.getvalue()


def write_tables(tables):
    source = []
    for name, rows in zip(("BCSO", "LOW_INCOME"), tables):
        data = ",\n".join("  " + json.dumps(row, separators=(", ", ":")) for row in rows)
        source.append(f"export const {name} = Object.freeze([\n{data}\n].map(row => Object.freeze(row)));")
    text = MODULE.read_text()
    before, middle = text.split("// BEGIN SOURCE DATA\n")
    _, after = middle.split("// END SOURCE DATA")
    MODULE.write_text(before + "// BEGIN SOURCE DATA\n" + "\n\n".join(source) + "\n// END SOURCE DATA" + after)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for source in SOURCES:
        parser.add_argument("--" + source, help=f"Existing pinned {source} source file")
    parser.add_argument("--write", action="store_true", help="Rebuild local files only after the three authorities agree")
    args = parser.parse_args()
    with tempfile.TemporaryDirectory() as directory:
        temp = Path(directory)
        act = act_rows(pdf_text(read_source("act", args.act, temp)))
        commission = commission_rows(pdf_text(read_source("commission", args.commission, temp)))
        client_text = read_source("client", args.client, temp).read_text()
    client = (client_table(client_text, '{adjusted:"800.00",one_child:"170.00"'),
              client_table(client_text, '{adjusted:"1,550",one_child:"295.00"'))
    for index, (heading, expected_range) in enumerate((("BCSO", range(800, 40001, 50)), ("LOW_INCOME", range(1550, 3951, 50)))):
        verify_equal(heading + " income axis", [r[0] for r in act[index]], list(expected_range))
        verify_equal(heading + " enacted vs Commission", act[index], commission[index])
        verify_equal(heading + " enacted vs official client", act[index], client[index])
    limits = re.search(r"bS=\{([^}]+)\},yS=\{([^}]+)\}", client_text)
    if not limits:
        raise ValueError("Unable to locate the pinned public client’s low-income constants.")
    client_limits, client_rates = [
        [float(value) for key, value in re.findall(r"(\d):([\d.]+)", section)]
        for section in limits.groups()
    ]
    terminal = [max(row[0] for row in act[1] if row[column] is not None) for column in range(1, 7)]
    verify_equal("Official client rates", client_rates, [r / 100 for r in LOW_RATES])
    verify_equal("Official client thresholds", client_limits, terminal)
    expected_fixture = fixture_text(commission)
    if args.write:
        write_tables(act)
        FIXTURE.write_text(expected_fixture)
    verify_equal("Independent Commission fixture", FIXTURE.read_text(), expected_fixture)
    exported = subprocess.check_output(
        ["node", "--input-type=module", "-e",
         "import {BCSO, LOW_INCOME, LOW_RATES, LOW_MAX} from './src/tables.mjs';"
         "console.log(JSON.stringify([BCSO, LOW_INCOME, LOW_RATES, LOW_MAX]));"],
        cwd=ROOT, text=True)
    actual = json.loads(exported)
    verify_equal("Runtime BCSO", actual[0], act[0])
    verify_equal("Runtime low-income table", actual[1], act[1])
    verify_equal("Runtime percentage rates", actual[2], [r / 100 for r in LOW_RATES])
    verify_equal("Runtime thresholds", actual[3], terminal)
    populated_low = sum(value is not None for row in act[1] for value in row[1:])
    print(f"Verified {len(act[0])} BCSO rows × 6 = {len(act[0])*6:,} amounts, {len(act[1])} low-income rows "
          f"({populated_low} populated amounts, {len(act[1])*6-populated_low} blanks), 6 rates and 6 thresholds.")
    print("Signed Act, Commission statute, public calculator table data, runtime module and independent fixture agree.")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as exc:
        sys.exit(str(exc))
