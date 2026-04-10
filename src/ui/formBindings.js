export function readModel(form) {
  const v = (name) => form.elements[name].value;
  const n = (name) => Number(v(name) || 0);
  const b = (name) => form.elements[name]?.checked ?? false;

  return {
    childCount: Number(v('childCount')),
    caseSetup: {
      courtOrderedParentingTime: v('courtOrderedParentingTime') === 'yes',
      splitParentingCase: b('splitParentingCase'),
      courtDesignatedNcpOverride: b('courtDesignatedNcpOverride')
    },
    incomes: { cpGrossMonthly: n('cpGrossMonthly'), ncpGrossMonthly: n('ncpGrossMonthly') },
    scheduleB: {
      cpSelfEmploymentTaxAdj: n('cpSelfEmploymentTaxAdj'),
      ncpSelfEmploymentTaxAdj: n('ncpSelfEmploymentTaxAdj'),
      cpPreexistingOrdersAdj: n('cpPreexistingOrdersAdj'),
      ncpPreexistingOrdersAdj: n('ncpPreexistingOrdersAdj'),
      cpQualifiedChildrenAdj: n('cpQualifiedChildrenAdj'),
      ncpQualifiedChildrenAdj: n('ncpQualifiedChildrenAdj')
    },
    parentingTime: {
      mode: v('parentingMode'),
      ncpDaysAverage: n('ncpDaysAverage'),
      child1NcpDays: n('child1NcpDays'),
      child2NcpDays: n('child2NcpDays')
    },
    additionalExpenses: {
      health: {
        amount: n('healthAmount'),
        payer: v('healthPayer'),
        attributionMode: v('healthAttributionMode'),
        familyPlanTotalCoveredPersons: n('familyPlanTotalCoveredPersons'),
        familyPlanChildrenInCaseCovered: n('familyPlanChildrenInCaseCovered')
      },
      workRelatedChildCare: { amount: n('childCareAmount'), payer: v('childCarePayer') }
    },
    deviations: {
      dental: { amount: n('dentalAmount'), payer: v('dentalPayer'), enabled: b('dentalEnabled') },
      vision: { amount: n('visionAmount'), payer: v('visionPayer'), enabled: b('visionEnabled') },
      highIncome: { mode: v('highIncomeMode'), manualUpwardDeviation: n('manualUpwardDeviation') }
    },
    options: { debugMode: b('debugMode'), roundCurrencyToCents: true }
  };
}
