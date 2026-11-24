import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeCalendar, worksheetDays } from '../src/calendar.mjs';

const sample = (rules = [], overrides = {}) => computeCalendar({
  start: '2026-01-01', base: 'A', method: 'overnights', rules, ...overrides
});
const range = (from, through, parent = 'B', start = '00:00', end = '24:00') =>
  ({kind: 'range', parent, from, through, start, end});
const daily = (r, d) => r.days.find(x => x.date === d);

test('two calendar years cover 730 distinct nights and partition hours', () => {
  const r = sample();
  assert.equal(r.days.length, 730);
  assert.equal(new Set(r.days.map(x => x.date)).size, 730);
  assert.equal(r.endExclusive, '2028-01-01');
  assert.deepEqual(r.annual, {A: 365, B: 0});
  assert.equal(r.years[0].hoursA + r.years[1].hoursA, 730 * 24);
});
test('the other parent may be the default residence', () => {
  assert.deepEqual(sample([], {base: 'B'}).annual, {A: 0, B: 365});
});
test('two nonconsecutive nights have an annual average of one day', () => {
  const r = sample([range('2026-01-03','2026-01-03'), range('2027-02-04','2027-02-04')]);
  assert.equal(r.annual.B, 1);
  assert.equal(r.years[1].nightsB, 1);
});
test('recurring daytime visits use all elapsed hours and contribute no overnight count', () => {
  const rule = {kind: 'weekly', parent:'B', weekday: 0, start:'10:00', nights:0, end:'16:00'};
  assert.equal(sample([rule]).annual.B, 0);
  const r = sample([rule], {method:'hours'});
  assert.equal(r.annual.B, 13); // 104 Sundays × 6 hours ÷ 24 ÷ 2
  assert.equal(r.years[0].hoursB + r.years[1].hoursB, 624);
});
test('mixed overnights and recurring daytime time use actual hours for both', () => {
  const r = sample([
    {kind:'weekly', parent:'B', weekday:1, nights:0, start:'15:00', end:'18:00'},
    range('2026-01-09','2026-01-11','B','18:00','10:00')
  ], {method:'hours'});
  assert.equal(r.annual.B, (104 * 3 + 40) / 48);
  assert.equal(r.years[0].nightsB, 2);
});
test('monthly schedule anchors on second/fourth Friday, Thursday–Monday', () => {
  const r = sample([{kind:'nth',parent:'B',weekday:5,nth:[2,4],offset:-1,start:'16:00',nights:4,end:'08:00'}]);
  assert.equal(r.annual.B, 96); // 48 visits × 4 nights ÷ 2
  assert.equal(daily(r,'2026-01-08').overnight,'B');
  assert.equal(daily(r,'2026-01-11').overnight,'B');
  assert.equal(daily(r,'2026-01-12').overnight,'A');
  assert.equal(daily(r,'2026-01-16').overnight,'A');
  assert.equal(daily(r,'2026-01-22').overnight,'B');
});
test('fifth occurrence is different from last in a four-Friday month', () => {
  const base = {kind:'nth',parent:'B',weekday:5,from:'2026-02-01',through:'2026-02-28',nights:1};
  assert.equal(sample([{...base,nth:[5]}]).annual.B, 0);
  assert.equal(sample([{...base,nth:[-1]}]).annual.B, .5);
});
test('fifth/last Friday in the same month contributes a single visit', () => {
  const r = sample([{kind:'nth',parent:'B',weekday:5,nth:[5,-1],from:'2026-01-01',through:'2026-01-31',nights:1}]);
  assert.equal(r.annual.B,.5);
});
test('a monthly pickup can start in the previous month', () => {
  const r = sample([{kind:'nth',parent:'B',weekday:5,nth:[1],offset:-1,nights:2,from:'2027-01-01',through:'2027-01-01'}]);
  assert.equal(daily(r,'2026-12-31').overnight,'B');
  assert.equal(daily(r,'2027-01-01').overnight,'B');
});
test('alternating Friday anchor includes a visit clipped at the end of year two', () => {
  const r = sample([{kind:'alternate',parent:'B',weekday:5,anchor:'2026-01-02',nights:3}]);
  assert.equal(r.annual.B,78.5); // 52 complete long weekends and one Friday before the window ends
  assert.equal(daily(r,'2026-01-09').overnight,'A');
  assert.equal(daily(r,'2026-01-16').overnight,'B');
});
test('alternating recurrence extends backward from a later anchor', () => {
  const r = sample([{kind:'alternate',parent:'B',weekday:5,anchor:'2026-01-16',nights:1}]);
  assert.equal(daily(r,'2026-01-02').overnight,'B');
});
test('regular visit crossing the beginning of the assessment is included', () => {
  const r = sample([{kind:'weekly',parent:'B',weekday:3,nights:3,from:'2025-12-31',through:'2025-12-31'}]);
  assert.equal(daily(r,'2026-01-01').overnight,'B');
  assert.equal(daily(r,'2026-01-02').overnight,'B');
  assert.equal(r.annual.B,1);
});
test('last matching range overrides only overlapping hours and underlying plan resumes', () => {
  const r=sample([
    range('2026-06-01','2026-06-05'),
    range('2026-06-02','2026-06-04','A','12:00','10:00'),
    range('2026-06-03','2026-06-03','B','14:00','17:15')
  ], {method:'hours'});
  assert.equal(daily(r,'2026-06-02').hoursB,12);
  assert.equal(daily(r,'2026-06-03').hoursB,3.25);
  assert.equal(daily(r,'2026-06-04').hoursB,14);
  assert.equal(daily(r,'2026-06-05').hoursB,24);
});
test('ordering controls holiday and exception priority', () => {
  const breakRule = range('2026-12-20','2026-12-28');
  const holiday = range('2026-12-25','2026-12-25','A');
  assert.equal(sample([breakRule, holiday]).annual.B,4);
  assert.equal(sample([holiday, breakRule]).annual.B,4.5);
});
test('an end exactly at midnight assigns the preceding night to the departing parent', () => {
  const r=sample([range('2026-04-12','2026-04-13','B','23:59','00:00')]);
  assert.equal(daily(r,'2026-04-12').overnight,'B');
  assert.equal(daily(r,'2026-04-13').overnight,'A');
  assert.equal(daily(r,'2026-04-12').hoursB,1/60);
});
test('overlapping same-parent visits count each instant only once', () => {
  const r=sample([range('2026-09-01','2026-09-02'),range('2026-09-02','2026-09-03')]);
  assert.equal(r.annual.B,1.5);
});
test('one long weekly rule may overlap successive starts without losing inactive/active state', () => {
  const r=sample([{kind:'weekly',parent:'B',weekday:5,nights:10,from:'2026-01-02',through:'2026-01-09'}]);
  assert.equal(r.annual.B,8.5);
});
test('summer rotation covers both parents and displaces the school-weekend schedule', () => {
  const r=sample([
    {kind:'weekly',parent:'B',weekday:5,nights:2},
    {kind:'rotation',parent:'B',from:'2026-06-01',through:'2026-07-31',anchor:'2026-06-05',block:7,start:'17:00'},
    range('2026-06-20','2026-06-20','A')
  ]);
  assert.equal(daily(r,'2026-06-05').hoursA,17);
  assert.equal(daily(r,'2026-06-05').overnight,'B');
  assert.equal(daily(r,'2026-06-12').overnight,'A');
  assert.equal(daily(r,'2026-06-13').overnight,'A');
  assert.equal(daily(r,'2026-06-20').overnight,'A');
  assert.equal(daily(r,'2026-08-01').overnight,'B');
});
test('outside-window rotation does not introduce phantom time', () => {
  assert.equal(sample([{kind:'rotation',parent:'B',from:'2023-01-01',through:'2023-01-31',anchor:'2023-01-01'}]).annual.B,0);
});
test('spring and fall civil days contain 23 and 25 actual hours in Georgia', () => {
  const r=sample([range('2026-03-08','2026-03-08'),range('2026-11-01','2026-11-01')], {method:'hours'});
  assert.equal(daily(r,'2026-03-08').hoursB,23);
  assert.equal(daily(r,'2026-11-01').hoursB,25);
  assert.equal(r.annual.B,1);
});
test('repeated autumn hour is interpreted as the first occurrence and disclosed', () => {
  const r=sample([range('2026-11-01','2026-11-01','B','01:30','03:00')]);
  assert.equal(daily(r,'2026-11-01').hoursB,2.5);
  assert.ok(r.warnings.some(x=>x.includes('first occurrence')));
});
test('invalid spring clock time is reported', () => {
  assert.throws(()=>sample([range('2026-03-08','2026-03-08','B','02:30','04:00')]),/does not exist/);
});
test('leap day is present in raw averages and preserved in its own assessment year', () => {
  const r=sample([range('2028-02-29','2028-02-29')],{start:'2027-04-01'});
  assert.equal(r.days.length,731);
  assert.equal(r.years[0].nightsB,1);
  assert.equal(r.annual.A + r.annual.B,365.5);
  assert.equal(worksheetDays(r,'B'),.5);
  assert.ok(r.warnings.some(x=>x.includes('731')));
});
test('Feb 29 start has documented non-leap anniversary dates', () => {
  const r=sample([],{start:'2028-02-29'});
  assert.equal(r.years[1].start,'2029-02-28');
  assert.equal(r.endExclusive,'2030-02-28');
  assert.ok(r.warnings.some(x=>x.includes('anniversary')));
});
test('official worksheet limit allows exactly 182.5', () => {
  const r=sample([range('2026-01-01','2026-12-31')]);
  assert.equal(worksheetDays(r,'A'),182.5);
  assert.equal(worksheetDays(r,'B'),182.5);
});
test('worksheet helper never silently rescales a majority-parent count', () => {
  assert.throws(()=>worksheetDays(sample(),'A'),/182\.5/);
  assert.equal(worksheetDays(sample(),'B'),0);
});
test('an equal actual-hour split of 731 calendar days cannot be silently normalized', () => {
  const r=sample([range('2027-01-01','2028-01-01','B','00:00','12:00')],{start:'2027-01-01',method:'hours'});
  assert.deepEqual(r.annual,{A:182.75,B:182.75});
  assert.throws(()=>worksheetDays(r,'B'),/182\.5/);
});

const badPlans=[
  [{start:'2026-02-29'},/valid date/],
  [{start:'2026-13-01'},/valid date/],
  [{start:'26-02-03'},/YYYY-MM-DD/],
  [{start:'2199-01-01'},/2197/],
  [{base:'C'},/Parent A or Parent B/],
  [{method:'mixed'},/overnight counting/],
  [{rules:{}},/200 rules/],
  [{rules:Array(201).fill({})},/200 rules/]
];
for(const [input,error] of badPlans) test('invalid plan: '+JSON.stringify(input).slice(0,60),()=>{
  assert.throws(()=>sample([],input),error);
});
const badRules=[
  [null,/rule 1/i],
  [{kind:'other',parent:'B'},/Unknown/],
  [range('2026-01-01','2026-01-01','C'),/Parent A or Parent B/],
  [range('2026-01-02','2026-01-01'),/last date/i],
  [range('2026-01-02','2026-01-02','B','20:00','08:00'),/follow/],
  [range('2026-01-02','2026-01-02','B','24:00','24:00'),/valid 24-hour/],
  [range('2026-01-02','2026-01-02','B','02:70','24:00'),/valid 24-hour/],
  [{kind:'weekly',parent:'A',weekday:7},/Weekday/],
  [{kind:'weekly',parent:'A',nights:32},/return date/],
  [{kind:'weekly',parent:'A',nights:0,start:'12:00',end:'12:00'},/return must follow/],
  [{kind:'weekly',parent:'A',offset:-7},/offset/],
  [{kind:'nth',parent:'B',weekday:6,nth:[6]},/occurrences/],
  [{kind:'nth',parent:'B',nth:[]},/occurrences/],
  [{kind:'alternate',parent:'B',weekday:1,anchor:'2026-01-01'},/anchor must fall/],
  [{kind:'alternate',parent:'B'},/anchor needs a date/],
  [{kind:'rotation',parent:'A',from:'2026-01-01',through:'2026-02-01',block:0},/rotating block/],
  [{kind:'range',parent:'B'},/needs a date/]
];
for (const [i,[input, error]] of badRules.entries()) test('invalid rule '+(i+1)+' gives an actionable error',()=>{
  assert.throws(()=>sample([input]),error);
});
