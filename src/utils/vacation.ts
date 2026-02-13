const FEDERAL_HOLIDAYS_2026 = new Set([
  '2026-01-01',
  '2026-01-02',
  '2026-01-03',
  '2026-01-04',
  '2026-01-05',
  '2026-01-06',
  '2026-01-07',
  '2026-01-08',
  '2026-02-23',
  '2026-03-08',
  '2026-05-01',
  '2026-05-09',
  '2026-06-12',
  '2026-11-04'
]);

const toDate = (input: string): Date => {
  const [year, month, day] = input.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const toKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const isFederalHoliday = (date: string): boolean => FEDERAL_HOLIDAYS_2026.has(date);

export const countVacationDaysByLaborCode = (startDate: string, endDate: string): number => {
  const start = toDate(startDate);
  const end = toDate(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return 0;

  const cursor = new Date(start);
  let days = 0;

  while (cursor <= end) {
    const currentKey = toKey(cursor);
    if (!isFederalHoliday(currentKey)) {
      days += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
};

export const validateVacationPartByLaborCode = (
  existingRequestsDays: number[],
  nextRequestDays: number
): { valid: boolean; message?: string } => {
  const allParts = [...existingRequestsDays, nextRequestDays].filter((value) => value > 0);
  if (allParts.length === 0) return { valid: false, message: 'Период отпуска не может быть пустым.' };

  const hasAtLeastTwoWeeks = allParts.some((value) => value >= 14);
  if (!hasAtLeastTwoWeeks) {
    return { valid: false, message: 'По ТК РФ минимум одна часть отпуска должна быть не менее 14 календарных дней.' };
  }

  const total = allParts.reduce((sum, value) => sum + value, 0);
  if (total > 28) {
    return { valid: false, message: 'Превышен базовый ежегодный отпуск 28 календарных дней (ст. 115 ТК РФ).' };
  }

  return { valid: true };
};
