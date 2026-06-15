import type { CellValue, Employee, WorkObject } from '../types';
import { getAdministratorLabel, SPECIAL_LABELS, WEEKDAY_SHORT } from './constants';
import { buildDateKey, daysInMonth, formatDateDmy, getWeekdayIndexMondayFirst } from './date';

interface ExportParams {
  year: number;
  month: number;
  employees: Employee[];
  objects: WorkObject[];
  getCellValue: (employeeId: string, date: string) => CellValue;
}

interface VacationExportRow {
  employeeName: string;
  monthKey: string;
  startDate: string;
  endDate: string;
  vacationDays: number;
  source: 'employee' | 'admin';
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
      if (value.type === 'OBJECT' || value.type === 'ADMINISTRATOR') {
        const objectItem = objects.find((item) => item.id === value.value);
        row.push(value.type === 'ADMINISTRATOR' && objectItem ? getAdministratorLabel(objectItem) : objectItem?.short_ru ?? '');
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

export const exportVacationsToCsv = (rows: VacationExportRow[], adminId: string): void => {
  const headers = ['Сотрудник', 'Месяц', 'Начало отпуска', 'Конец отпуска', 'Дней к оплате', 'Источник'];
  const lines: string[] = [headers.map(escapeCell).join(';')];

  for (const row of rows) {
    lines.push(
      [
        row.employeeName,
        row.monthKey,
        formatDateDmy(row.startDate),
        formatDateDmy(row.endDate),
        String(row.vacationDays),
        row.source === 'employee' ? 'Сотрудник' : 'Админ'
      ]
        .map(escapeCell)
        .join(';')
    );
  }

  const csv = `\uFEFF${lines.join('\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `vacations-${adminId}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};
