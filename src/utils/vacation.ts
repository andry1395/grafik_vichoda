const toDate = (input: string): Date => {
  const [year, month, day] = input.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const doesVacationIntersectMonth = (startDate: string, endDate: string, monthKey: string): boolean => {
  const start = toDate(startDate);
  const end = toDate(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return false;

  const [yearRaw, monthRaw] = monthKey.split('-').map(Number);
  if (!yearRaw || !monthRaw) return false;

  const monthStart = new Date(yearRaw, monthRaw - 1, 1);
  const monthEnd = new Date(yearRaw, monthRaw, 0);

  return start <= monthEnd && end >= monthStart;
};

export const countVacationDaysByLaborCode = (startDate: string, endDate: string): number => {
  const start = toDate(startDate);
  const end = toDate(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return 0;

  const millisecondsPerDay = 86_400_000;
  const normalizedStart = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const normalizedEnd = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());

  return Math.floor((normalizedEnd - normalizedStart) / millisecondsPerDay) + 1;
};

export const validateVacationPartByLaborCode = (
  existingRequestsDays: number[],
  nextRequestDays: number
): { valid: boolean; message?: string } => {
  const allParts = [...existingRequestsDays, nextRequestDays].filter((value) => value > 0);
  if (allParts.length === 0) return { valid: false, message: 'Период отпуска не может быть пустым.' };

  const total = allParts.reduce((sum, value) => sum + value, 0);
  if (total > 28) {
    return { valid: false, message: 'Нельзя превысить 28 календарных дней отпуска в год.' };
  }

  return { valid: true };
};
