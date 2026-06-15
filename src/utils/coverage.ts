import type { CellValue, Employee, WorkObject } from '../types';
import { buildDateKey, daysInMonth, formatDateRu } from './date';

interface CoverageParams {
  year: number;
  month: number;
  employees: Employee[];
  objects: WorkObject[];
  getCellValue: (employeeId: string, date: string) => CellValue;
}

export interface CoverageIssue {
  date: string;
  missingObjects: WorkObject[];
}

export interface CoverageObjectStatus {
  object: WorkObject;
  missingDates: string[];
}

export const getCoverageIssues = ({ year, month, employees, objects, getCellValue }: CoverageParams): CoverageIssue[] => {
  const activeObjects = objects.filter((item) => item.active);
  const issues: CoverageIssue[] = [];
  const totalDays = daysInMonth(year, month);

  for (let day = 1; day <= totalDays; day += 1) {
    const date = buildDateKey(year, month, day);
    const assigned = new Set<string>();

    for (const employee of employees) {
      const cell = getCellValue(employee.id, date);
      if (cell.type === 'OBJECT' || cell.type === 'ADMINISTRATOR') {
        assigned.add(cell.value);
      }
    }

    const missingObjects = activeObjects.filter((objectItem) => !assigned.has(objectItem.id));
    if (missingObjects.length > 0) {
      issues.push({ date, missingObjects });
    }
  }

  return issues;
};

export const getCoverageStatusByObject = (objects: WorkObject[], issues: CoverageIssue[]): CoverageObjectStatus[] => {
  const activeObjects = objects.filter((item) => item.active);

  return activeObjects.map((object) => ({
    object,
    missingDates: issues
      .filter((issue) => issue.missingObjects.some((missingObject) => missingObject.id === object.id))
      .map((issue) => issue.date),
  }));
};

export const coverageIssueToText = (issue: CoverageIssue): string => {
  const missing = issue.missingObjects.map((item) => item.short_ru || item.name_ru).join(', ');
  return `${formatDateRu(issue.date)}: нет назначений на объекты [${missing}]`;
};

export const coverageObjectStatusToText = (status: CoverageObjectStatus): string => {
  const objectName = status.object.short_ru || status.object.name_ru;
  if (status.missingDates.length === 0) {
    return `${objectName}, всё заполнено`;
  }

  const days = status.missingDates.map((date) => formatDateRu(date).slice(0, 2)).join(', ');
  return `${objectName}, ${days}`;
};
