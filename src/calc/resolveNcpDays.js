export function resolveNcpDays(model) {
  const childCount = Number(model.childCount || 0);
  const mode = model.parentingTime?.mode || 'average_days';

  const averageDays = Number(model.parentingTime?.ncpDaysAverage || 0);
  const child1Days = Number(model.parentingTime?.child1NcpDays || 0);
  const child2Days = Number(model.parentingTime?.child2NcpDays || 0);

  if (childCount === 1) {
    return mode === 'per_child_days' ? child1Days : averageDays;
  }

  if (mode === 'per_child_days') {
    return (child1Days + child2Days) / 2;
  }

  return averageDays;
}
