import type { Employee, SpecialValue, WorkObject } from '../types';
import { SPECIAL_LABELS, WEEKDAY_SHORT } from './constants';
import { buildDateKey, daysInMonth, getWeekdayIndexMondayFirst } from './date';

interface ExportParams {
  year: number;
  month: number;
  employees: Employee[];
  objects: WorkObject[];
  getCellValue: (employeeId: string, date: string) => { type: 'OBJECT'; value: string } | { type: 'SPECIAL'; value: SpecialValue };
}

const escapeCell = (value: string): string => `"${value.split("\"").join("\"\"")}"`;

const monthName = (month: number): string => String(month).padStart(2, '0');

/**
 * Экспортирует данные в CSV с BOM в кодировке UTF-8.
 * Файл сохраняется в формате .csv (UTF-8 BOM), который корректно открывается в Excel.
 */
export const exportMonthToXlsx = ({ year, month, employees, objects, getCellValue }: ExportParams): void => {
  const days = daysInMonth(year, month);
  const headers = ['Сотрудник'];

  for (let day = 1; day <= days; day += 1) {
    const weekdayIndex = getWeekdayIndexMondayFirst(year, month, day);
    headers.push(`${String(day).padStart(2, '0')} ${WEEKDAY_SHORT[weekdayIndex]}`);
  }

  const lines: string[] = [headers.map(escapeCell).join(';')];

  for (const employee of employees) {
    const row: string[] = [employee.full_name];
    for (let day = 1; day <= days; day += 1) {
      const date = buildDateKey(year, month, day);
      const value = getCellValue(employee.id, date);
      if (value.type === 'OBJECT') {
        row.push(objects.find((item) => item.id === value.value)?.short_ru ?? '');
      } else {
        row.push(SPECIAL_LABELS[value.value]);
      }
    }
    lines.push(row.map(escapeCell).join(';'));
  }

  const csv = `\uFEFF${lines.join('\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `grafik-${year}-${monthName(month)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};
