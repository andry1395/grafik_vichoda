export const buildMonthKey = (year: number, month: number): string =>
  `${year}-${String(month).padStart(2, '0')}`;

export const buildDateKey = (year: number, month: number, day: number): string =>
  `${buildMonthKey(year, month)}-${String(day).padStart(2, '0')}`;

export const formatDateRu = (isoDate: string): string => {
  const date = new Date(`${isoDate}T00:00:00`);
  return new Intl.DateTimeFormat('ru-RU').format(date);
};

export const daysInMonth = (year: number, month: number): number => {
  return new Date(year, month, 0).getDate();
};

export const getWeekdayIndexMondayFirst = (year: number, month: number, day: number): number => {
  const jsDay = new Date(year, month - 1, day).getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
};
