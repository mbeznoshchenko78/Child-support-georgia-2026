/** Georgia parenting-time calendar. Civil dates use America/New_York, independent of the device. */
const DAY = 1440;
const MS = 60000;
const zoneFormat = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  timeZone: "America/New_York",
  timeZoneName: "shortOffset",
});

function dateText(day) {
  return new Date(day * DAY * MS).toISOString().slice(0, 10);
}

function dayOf(text, label) {
  if (typeof text !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new Error(`${label} needs a date in YYYY-MM-DD format.`);
  }
  const day = Date.parse(text + "T00:00:00Z") / (DAY * MS);
  if (
    !Number.isInteger(day) ||
    dateText(day) !== text ||
    text < "1970-01-01" ||
    text > "2199-12-31"
  ) {
    throw new Error(`${label} needs a valid date from 1970 through 2199.`);
  }
  return day;
}

function anniversary(day, years) {
  const date = dateText(day);
  const year = Number(date.slice(0, 4)) + years;
  const february29 =
    date.endsWith("-02-29") &&
    new Date(Date.UTC(year, 1, 29)).getUTCMonth() !== 1;
  return (
    Date.parse(year + (february29 ? "-02-28" : date.slice(4)) + "T00:00:00Z") /
    (DAY * MS)
  );
}

function minuteOf(text, allowEndOfDay) {
  if (allowEndOfDay && text === "24:00") return DAY;
  if (typeof text !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) {
    throw new Error(
      "Use a valid 24-hour time, for example 16:00. Only an end time may be 24:00.",
    );
  }
  return Number(text.slice(0, 2)) * 60 + Number(text.slice(3));
}

function checkedInteger(value, min, max, label) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${label} must be a whole number from ${min} to ${max}.`);
  }
  return value;
}

function other(parent) {
  return parent === "A" ? "B" : "A";
}

function checkParent(parent) {
  if (parent !== "A" && parent !== "B")
    throw new Error("Select Parent A or Parent B.");
  return parent;
}

// Convert Georgia wall minutes to actual minutes. Midnight offsets by UTC date are cached for
// speed; transition days may have two or zero valid instants for a local clock reading.
function easternClock(warnings) {
  const midnightOffset = new Map();
  function at(instant) {
    const part = zoneFormat
      .formatToParts(new Date(instant * MS))
      .find((x) => x.type === "timeZoneName");
    const match = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(part.value);
    if (!match)
      throw new Error(
        "Georgia time zone information is unavailable in this browser.",
      );
    return (
      (match[1] === "-" ? -1 : 1) *
      (Number(match[2]) * 60 + Number(match[3] || 0))
    );
  }
  function atMidnight(day) {
    if (!midnightOffset.has(day)) midnightOffset.set(day, at(day * DAY));
    return midnightOffset.get(day);
  }
  return function instant(wall) {
    const day = Math.floor(wall / DAY);
    const before = atMidnight(day);
    const after = atMidnight(day + 1);
    if (before === after) return wall - before;
    const candidates = [wall - before, wall - after]
      .filter((t) => t + at(t) === wall)
      .sort((a, b) => a - b);
    if (candidates.length === 1) return candidates[0];
    const hour = String(Math.floor((wall % DAY) / 60)).padStart(2, "0");
    const minute = String(wall % 60).padStart(2, "0");
    const when = dateText(day) + " " + hour + ":" + minute;
    if (candidates.length === 2) {
      warnings.add(
        `On ${when} the Georgia clock repeats. This calendar uses the first occurrence.`,
      );
      return candidates[0];
    }
    throw new Error(
      `${when} does not exist on Georgia's spring clock-change day. Specify a valid exchange time.`,
    );
  };
}

const weekdayOf = (day) => (((day + 4) % 7) + 7) % 7;
const modulo = (value, divisor) => ((value % divisor) + divisor) % divisor;

function recurring(rule, from, through, windowStart, windowEnd, add) {
  const weekday = checkedInteger(rule.weekday ?? 5, 0, 6, "Weekday");
  const offset = checkedInteger(rule.offset ?? 0, -6, 6, "Pickup day offset");
  const nights = checkedInteger(rule.nights ?? 2, 0, 31, "Days to return date");
  const startTime = minuteOf(rule.start ?? "17:00", false);
  const endTime = minuteOf(rule.end ?? "09:00", true);
  if (nights * DAY + endTime <= startTime)
    throw new Error("The return must follow the pickup.");
  let anchor;
  let ordinals;
  if (rule.kind === "alternate") {
    anchor = dayOf(rule.anchor, "Alternating-week anchor");
    if (weekdayOf(anchor) !== weekday)
      throw new Error(
        "The alternating-week anchor must fall on the selected weekday.",
      );
  }
  if (rule.kind === "nth") {
    if (
      !Array.isArray(rule.nth) ||
      rule.nth.length < 1 ||
      rule.nth.length > 6
    ) {
      throw new Error(
        "Choose month occurrences 1–5 or −1 for the last occurrence.",
      );
    }
    ordinals = new Set(rule.nth);
    for (const n of ordinals) {
      if (![1, 2, 3, 4, 5, -1].includes(n))
        throw new Error(
          "Month occurrences are 1–5 or −1 for the last occurrence.",
        );
    }
  }
  // Anchor dates can fall outside the window when a visit crosses a month or assessment boundary.
  const lo = Math.max(from, windowStart - nights - offset - 1);
  const hi = Math.min(through, windowEnd - offset);
  for (let day = lo + modulo(weekday - weekdayOf(lo), 7); day <= hi; day += 7) {
    if (rule.kind === "alternate" && modulo(day - anchor, 14) !== 0) continue;
    if (rule.kind === "nth") {
      const dom = new Date(day * DAY * MS).getUTCDate();
      const last = new Date((day + 7) * DAY * MS).getUTCDate() <= 7;
      if (!ordinals.has(Math.ceil(dom / 7)) && !(last && ordinals.has(-1)))
        continue;
    }
    const first = day + offset;
    add(first * DAY + startTime, (first + nights) * DAY + endTime, rule.parent);
  }
}

function addRule(rule, left, right, add) {
  if (!rule || typeof rule !== "object" || Array.isArray(rule))
    throw new Error("Each rule must be an object.");
  checkParent(rule.parent);
  const dated = rule.kind === "range" || rule.kind === "rotation";
  const from = rule.from || dated ? dayOf(rule.from, "Start date") : left - 40;
  const through =
    rule.through || dated ? dayOf(rule.through, "Last date") : right + 8;
  if (through < from)
    throw new Error("The last date must be on or after the start date.");
  if (rule.kind === "range") {
    const start = from * DAY + minuteOf(rule.start ?? "00:00", false);
    const end = through * DAY + minuteOf(rule.end ?? "24:00", true);
    if (end <= start)
      throw new Error("The end of the interval must follow its start.");
    add(start, end, rule.parent);
  } else if (rule.kind === "rotation") {
    const block = checkedInteger(
      rule.block ?? 7,
      1,
      60,
      "Length of a rotating block",
    );
    const anchor = dayOf(rule.anchor, "First block anchor");
    const change = minuteOf(rule.start ?? "17:00", false);
    const period = block * DAY;
    const origin = anchor * DAY + change;
    const start = Math.max(from, left) * DAY;
    const end = (Math.min(through, right - 1) + 1) * DAY;
    for (
      let i = Math.floor((start - origin) / period);
      origin + i * period < end;
      i++
    ) {
      const first = Math.max(start, origin + i * period);
      const last = Math.min(end, origin + (i + 1) * period);
      if (first < last)
        add(first, last, modulo(i, 2) === 0 ? rule.parent : other(rule.parent));
    }
  } else if (["weekly", "alternate", "nth"].includes(rule.kind)) {
    recurring(rule, from, through, left, right, add);
  } else {
    throw new Error("Unknown calendar rule type.");
  }
}

/**
 * Compute two anniversary years from a plan. Precedence follows list order, with later rules
 * overriding overlapping instants only. A range's "through" date contains its ending time;
 * 24:00 includes that entire civil day. Repeating visit date filters apply to anchor dates.
 */
export function computeCalendar(plan) {
  if (!plan || typeof plan !== "object" || Array.isArray(plan))
    throw new Error("Enter a calendar plan.");
  const left = dayOf(plan.start, "Calendar start");
  if (plan.start > "2197-12-31")
    throw new Error(
      "Choose a start no later than 2197 so both years fit the calendar.",
    );
  const middle = anniversary(left, 1);
  const right = anniversary(left, 2);
  const base = checkParent(plan.base ?? "A");
  const method = plan.method ?? "overnights";
  if (!["overnights", "hours"].includes(method))
    throw new Error("Select overnight counting or total hours.");
  const rules = plan.rules ?? [];
  if (!Array.isArray(rules) || rules.length > 200)
    throw new Error("A plan can contain up to 200 rules.");
  const warnings = new Set();
  if (dateText(left).endsWith("-02-29"))
    warnings.add(
      "A February 29 start uses February 28 for a non-leap anniversary.",
    );
  if (right - left !== 730)
    warnings.add(
      "The two-year calendar includes 731 civil dates. Raw annual shares total 365.5 days. For Schedule C, enter the verified noncustodial average within its 182.5-day limit and use 365 less that average for the other parent.",
    );
  const instant = easternClock(warnings);
  const events = [];
  rules.forEach((rule, index) => {
    try {
      addRule(rule, left, right, (start, end, parent) => {
        const first = Math.max(start, left * DAY);
        const last = Math.min(end, right * DAY);
        if (first >= last) return;
        events.push(
          { at: instant(first), index, parent, delta: 1 },
          { at: instant(last), index, parent, delta: -1 },
        );
      });
    } catch (error) {
      throw new Error(`Calendar rule ${index + 1}: ${error.message}`);
    }
  });
  events.sort((a, b) => a.at - b.at || a.delta - b.delta);
  const active = new Map();
  const days = [];
  const years = [
    [left, middle],
    [middle, right],
  ].map(([a, b]) => ({
    start: dateText(a),
    endExclusive: dateText(b),
    nightsA: 0,
    nightsB: 0,
    hoursA: 0,
    hoursB: 0,
    daysA: 0,
    daysB: 0,
  }));
  let cursor = 0;
  let holder = base;
  function applyEvents(at) {
    if (cursor >= events.length || events[cursor].at !== at) return;
    while (cursor < events.length && events[cursor].at === at) {
      const ev = events[cursor++];
      const count = (active.get(ev.index)?.count ?? 0) + ev.delta;
      if (count === 0) active.delete(ev.index);
      else active.set(ev.index, { count, parent: ev.parent });
    }
    holder = active.size ? active.get(Math.max(...active.keys())).parent : base;
  }
  const minutesByYear = [
    [0, 0],
    [0, 0],
  ];
  for (let day = left; day < right; day++) {
    let pos = instant(day * DAY);
    const end = instant((day + 1) * DAY);
    const minutes = [0, 0];
    while (pos < end) {
      applyEvents(pos);
      const next = Math.min(end, events[cursor]?.at ?? end);
      minutes[holder === "A" ? 0 : 1] += next - pos;
      pos = next;
    }
    // The preceding evening belongs to the parent holding the child immediately before midnight.
    days.push({
      date: dateText(day),
      overnight: holder,
      hoursA: minutes[0] / 60,
      hoursB: minutes[1] / 60,
    });
    const y = day < middle ? 0 : 1;
    years[y]["nights" + holder]++;
    minutesByYear[y][0] += minutes[0];
    minutesByYear[y][1] += minutes[1];
  }
  for (const [y, year] of years.entries()) {
    for (const [p, parent] of ["A", "B"].entries()) {
      year["hours" + parent] = minutesByYear[y][p] / 60;
      year["days" + parent] =
        method === "hours"
          ? minutesByYear[y][p] / DAY
          : year["nights" + parent];
    }
  }
  const annual = Object.fromEntries(
    ["A", "B"].map((p) => [
      p,
      (years[0]["days" + p] + years[1]["days" + p]) / 2,
    ]),
  );
  return {
    start: dateText(left),
    endExclusive: dateText(right),
    base,
    method,
    days,
    years,
    annual,
    warnings: [...warnings],
  };
}

/** Commission Schedule C uses 365 days and accepts at most 182.5 for the NCP. */
export function worksheetDays(result, ncp) {
  const value = result?.annual?.[checkParent(ncp)];
  if (!Number.isFinite(value) || value < 0)
    throw new Error("Calculate this calendar before using its annual average.");
  if (value > 182.5)
    throw new Error(
      "This raw annual average exceeds the official 182.5-day noncustodial limit. Review residence, leap dates and any equal-time designation before entering Schedule C days.",
    );
  return value;
}
