import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { calculate } from '../src/engine.mjs';
import { fromWorksheet } from './worksheet-input.mjs';

const cases = JSON.parse(readFileSync(new URL('./fixtures/official-results.json', import.meta.url)));

const legislativeDifferences = {
  'low-plus-deviation':239.69,
  'low-ceiling-equality':1022.54,
  'low-income-special-mixed':151,
  'one-zero-positive-d':0,
};

for (const { input, lines } of cases) {
  test(`published worksheet display • ${input.id}`, () => {
    const scenario = fromWorksheet(input);
    if (input.children > 6 || input.gross.every(value => value === 0)) {
      const message = input.children > 6 ? /[Cc]hildren.*6/ : /zero.*pro rata/i;
      assert.throws(() => calculate(scenario), message, 'Outside the independently verified statutory domain');
      return;
    }
    const result = calculate(scenario);
    const index = input.ncp ?? 1;
    const ncp = index === 0 ? 'A' : 'B';
    assert.equal(result.ncp, ncp, 'Legal role');
    for (const [i,id] of ['A','B'].entries()) {
      assert.equal(result.inc[id].adjusted, lines.adjusted[i], `${id} L2 adjusted income`);
      assert.equal(Math.round(result.share[id]*10000)/100, lines.percentages[i], `${id} L3 income percentage`);
      assert.equal(result.basic[id], lines.basicShares[i], `${id} L5 basic share`);
      assert.equal(result.prorataD[id], lines.expenseShares[i], `${id} L7 allocated health and childcare`);
      assert.equal(result.adjustedBase[id], lines.adjustedObligation[i], `${id} L8 adjusted obligation`);
      assert.equal(result.paid[id], lines.expensePaid[i], `${id} L9 amounts paid`);
      assert.equal(result.presumptive[id], lines.presumptive[i], `${id} L10 presumptive`);
    }
    assert.equal(result.table.amount, lines.bcso, 'L4 BCSO');
    assert.equal(result.credit, lines.timeAdjustment, 'L6 parenting adjustment');
    assert.equal(result.clientBeforeE, lines.lowIncome[index], 'Official order L11');
    assert.equal(result.deviation, lines.deviations[index], 'Official L12 proposed deviations');
    assert.equal(result.clientFinal, lines.afterBenefits[index], 'Official transfer before final dollar rounding');
    assert.equal(result.final, legislativeDifferences[input.id] ?? lines.afterBenefits[index], 'Statutory calculation sequence');
    const officialRounded = Math.round(Math.abs(lines.afterBenefits[index]));
    assert.equal(Math.abs(result.roundAward(result.clientFinal)), officialRounded, 'Whole-dollar payment summary');
    if (officialRounded > 0) {
      const payer = lines.summary.startsWith('Parent A pays') ? 'A' : 'B';
      assert.equal(result.direction(result.clientFinal), payer, 'Official payment direction');
    }
  });
}
