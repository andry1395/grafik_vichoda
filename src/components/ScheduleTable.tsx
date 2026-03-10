import { useEffect, useMemo, useState } from 'react';
import type { Employee, SpecialValue, WorkObject } from '../types';
import { SPECIAL_LABELS, SPECIAL_OPTIONS, WEEKDAY_SHORT } from '../utils/constants';
import { buildDateKey, getWeekdayIndexMondayFirst } from '../utils/date';

const parseDateToUtc = (value: string): number => {
  const [yearPart, monthPart, dayPart] = value.split('-').map(Number);
  return Date.UTC(yearPart, monthPart - 1, dayPart);
};


const formatEmployeeDisplayName = (fullName: string): string => {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length < 2) {
    return fullName;
  }

  const [surname, name, patronymic] = parts;
  const nameInitial = `${name[0]}.`;
  const patronymicInitial = patronymic ? `${patronymic[0]}.` : '';

  return `${surname} ${nameInitial}${patronymicInitial}`;
};

interface ScheduleTableProps {
  year: number;
  month: number;
  employees: Employee[];
  objects: WorkObject[];
  readOnly?: boolean;
  selectedDate?: string | null;
  getCellValue: (employeeId: string, date: string) => { type: 'OBJECT'; value: string } | { type: 'SPECIAL'; value: SpecialValue };
  setCellValue?: (employeeId: string, date: string, value: { type: 'OBJECT'; value: string } | { type: 'SPECIAL'; value: SpecialValue }) => void;
  clearCellValue?: (employeeId: string, date: string) => void;
}

export const ScheduleTable = ({
  year,
  month,
  employees,
  objects,
  readOnly = false,
  selectedDate = null,
  getCellValue,
  setCellValue,
  clearCellValue
}: ScheduleTableProps): JSX.Element => {
  const ROTATION_OPTIONS = [
    { value: '5/2', workDays: 5, offDays: 2 },
    { value: '4/2', workDays: 4, offDays: 2 },
    { value: '4/3', workDays: 4, offDays: 3 }
  ] as const;

  const dayCount = new Date(year, month, 0).getDate();
  const previousMonthYear = month === 1 ? year - 1 : year;
  const previousMonth = month === 1 ? 12 : month - 1;
  const allDates = useMemo(
    () => Array.from({ length: dayCount }, (_, idx) => buildDateKey(year, month, idx + 1)),
    [dayCount, month, year]
  );

  const dates = useMemo(() => {
    if (!selectedDate) return allDates;
    return allDates.includes(selectedDate) ? [selectedDate] : allDates;
  }, [allDates, selectedDate]);


  const objectAssignmentsByDate = useMemo(() => {
    const assignments: Record<string, Record<string, { total: number; mechanics: number; trainees: number }>> = {};

    for (const date of dates) {
      assignments[date] = {};
      for (const employee of employees) {
        const cell = getCellValue(employee.id, date);
        if (cell.type !== 'OBJECT') continue;

        const current = assignments[date][cell.value] ?? { total: 0, mechanics: 0, trainees: 0 };
        current.total += 1;
        if (employee.role === 'trainee') {
          current.trainees += 1;
        } else {
          current.mechanics += 1;
        }
        assignments[date][cell.value] = current;
      }
    }

    return assignments;
  }, [dates, employees, getCellValue]);

  const [massValue, setMassValue] = useState<string>('SPECIAL:OFF');
  const [bulkEmployee, setBulkEmployee] = useState<string>('ALL');
  const [bulkFromDate, setBulkFromDate] = useState<string>(allDates[0] ?? '');
  const [bulkToDate, setBulkToDate] = useState<string>(allDates[allDates.length - 1] ?? '');
  const [rotationStartDate, setRotationStartDate] = useState<string>(allDates[0] ?? '');
  const [rotationMode, setRotationMode] = useState<(typeof ROTATION_OPTIONS)[number]['value']>('5/2');

  const minRotationStartDate = buildDateKey(previousMonthYear, previousMonth, 1);
  const maxRotationStartDate = allDates[allDates.length - 1] ?? '';

  useEffect(() => {
    setBulkFromDate(allDates[0] ?? '');
    setBulkToDate(allDates[allDates.length - 1] ?? '');
    setRotationStartDate(allDates[0] ?? '');
  }, [allDates]);

  const applyBulk = (): void => {
    if (!setCellValue || !bulkFromDate || !bulkToDate) return;
    const fromIndex = allDates.indexOf(bulkFromDate);
    const toIndex = allDates.indexOf(bulkToDate);
    if (fromIndex < 0 || toIndex < 0) return;

    const [type, value] = massValue.split(':') as ['OBJECT' | 'SPECIAL', string];
    const [start, end] = fromIndex <= toIndex ? [fromIndex, toIndex] : [toIndex, fromIndex];
    const targetEmployees = bulkEmployee === 'ALL' ? employees : employees.filter((employee) => employee.id === bulkEmployee);

    for (const employee of targetEmployees) {
      for (let index = start; index <= end; index += 1) {
        const date = allDates[index];
        if (!date) continue;
        if (type === 'OBJECT') {
          setCellValue(employee.id, date, { type: 'OBJECT', value });
        } else {
          setCellValue(employee.id, date, { type: 'SPECIAL', value: value as SpecialValue });
        }
      }
    }
  };

  const clearBulk = (): void => {
    if (!clearCellValue || !bulkFromDate || !bulkToDate) return;
    const fromIndex = allDates.indexOf(bulkFromDate);
    const toIndex = allDates.indexOf(bulkToDate);
    if (fromIndex < 0 || toIndex < 0) return;
    const [start, end] = fromIndex <= toIndex ? [fromIndex, toIndex] : [toIndex, fromIndex];
    const targetEmployees = bulkEmployee === 'ALL' ? employees : employees.filter((employee) => employee.id === bulkEmployee);

    for (const employee of targetEmployees) {
      for (let index = start; index <= end; index += 1) {
        const date = allDates[index];
        if (!date) continue;
        clearCellValue(employee.id, date);
      }
    }
  };

  const applyOffRotation = (): void => {
    if (!setCellValue || !rotationStartDate) return;

    const selectedRotation = ROTATION_OPTIONS.find((option) => option.value === rotationMode);
    if (!selectedRotation) return;

    const rotationStartUtc = parseDateToUtc(rotationStartDate);
    const cycleLength = selectedRotation.workDays + selectedRotation.offDays;
    const targetEmployees = bulkEmployee === 'ALL' ? employees : employees.filter((employee) => employee.id === bulkEmployee);

    for (const employee of targetEmployees) {
      for (const date of allDates) {
        const dayOffset = Math.floor((parseDateToUtc(date) - rotationStartUtc) / 86_400_000);
        if (dayOffset < 0) continue;
        const dayInCycle = dayOffset % cycleLength;
        if (dayInCycle >= selectedRotation.workDays) {
          setCellValue(employee.id, date, { type: 'SPECIAL', value: 'OFF' });
        }
      }
    }
  };

  return (
    <div>
      {!readOnly && (
        <>
          <div className="notice">
            <strong>Пакетное редактирование (без выделения мышью):</strong> выберите механика, диапазон дат и значение.
          </div>
          <div className="toolbar-row bulk-edit-row">
            <select value={bulkEmployee} onChange={(event) => setBulkEmployee(event.target.value)}>
              <option value="ALL">Все механики</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {formatEmployeeDisplayName(employee.full_name)}
                </option>
              ))}
            </select>
            <input type="date" value={bulkFromDate} onChange={(event) => setBulkFromDate(event.target.value)} />
            <input type="date" value={bulkToDate} onChange={(event) => setBulkToDate(event.target.value)} />
            <select value={massValue} onChange={(event) => setMassValue(event.target.value)}>
              {objects
                .filter((item) => item.active)
                .map((objectItem) => (
                  <option key={objectItem.id} value={`OBJECT:${objectItem.id}`}>
                    Объект: {objectItem.short_ru || objectItem.name_ru}
                  </option>
                ))}
              {SPECIAL_OPTIONS.map((option) => (
                <option key={option.value} value={`SPECIAL:${option.value}`}>
                  {option.description} ({option.label})
                </option>
              ))}
            </select>
            <button type="button" onClick={applyBulk}>
              Применить к диапазону
            </button>
            <button type="button" onClick={clearBulk}>
              Очистить диапазон
            </button>
          </div>
          <div className="toolbar-row bulk-edit-row">
            <strong>Чередование выходных:</strong>
            <input
              type="date"
              min={minRotationStartDate}
              max={maxRotationStartDate}
              value={rotationStartDate}
              onChange={(event) => setRotationStartDate(event.target.value)}
            />
            <select value={rotationMode} onChange={(event) => setRotationMode(event.target.value as (typeof ROTATION_OPTIONS)[number]['value'])}>
              {ROTATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.value}
                </option>
              ))}
            </select>
            <button type="button" onClick={applyOffRotation}>
              Применить чередование
            </button>
          </div>
        </>
      )}


      <div className="table-legend" aria-label="Легенда таблицы">
        <span className="legend-item">
          <span className="legend-dot legend-dot-single" /> Один сотрудник на объекте
        </span>
        <span className="legend-item">
          <span className="legend-dot legend-dot-trainee-only" /> В смене только стажер(ы)
        </span>
        <span className="legend-item">
          <span className="legend-dot legend-dot-too-many-mechanics" /> В смене больше 2 механиков
        </span>
      </div>

      <div className="table-wrap">
        <table className="schedule-table">
          <thead>
            <tr>
              <th className="sticky-col">Сотрудник</th>
              {dates.map((date) => {
                const day = Number(date.slice(-2));
                const weekday = getWeekdayIndexMondayFirst(year, month, day);
                const weekend = weekday >= 5;
                return (
                  <th key={date} className={weekend ? 'weekend' : ''}>
                    <div>{day}</div>
                    <div className="weekday">{WEEKDAY_SHORT[weekday]}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 && (
              <tr>
                <td colSpan={dates.length + 1}>Нет сотрудников по текущим фильтрам.</td>
              </tr>
            )}
            {employees.map((employee) => (
              <tr key={employee.id}>
                <td className="sticky-col">{formatEmployeeDisplayName(employee.full_name)}</td>
                {dates.map((date) => {
                  const value = getCellValue(employee.id, date);
                  const objectName = value.type === 'OBJECT' ? objects.find((item) => item.id === value.value)?.short_ru ?? '—' : '';
                  const display = value.type === 'OBJECT' ? objectName : SPECIAL_LABELS[value.value];
                  const isEmployeeOffDay = value.type === 'SPECIAL' && value.value === 'OFF';
                  const assignment = value.type === 'OBJECT' ? objectAssignmentsByDate[date]?.[value.value] : undefined;
                  const isSingleEmployeeOnObject = value.type === 'OBJECT' && (assignment?.total ?? 0) === 1;
                  const isTraineeOnlyShift = value.type === 'OBJECT' && (assignment?.total ?? 0) > 0 && (assignment?.mechanics ?? 0) === 0;
                  const isTooManyMechanicsShift = value.type === 'OBJECT' && (assignment?.mechanics ?? 0) > 2;

                  return (
                    <td
                      key={date}
                      className={[
                        isEmployeeOffDay ? 'employee-off-day' : '',
                        isSingleEmployeeOnObject ? 'single-employee-object-day' : '',
                        isTraineeOnlyShift ? 'trainee-only-shift-day' : '',
                        isTooManyMechanicsShift ? 'too-many-mechanics-shift-day' : ''
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      title={
                        isTraineeOnlyShift
                          ? 'На объект в эту смену назначены только стажеры'
                          : isTooManyMechanicsShift
                            ? 'На объект в эту смену назначены более 2 механиков'
                          : isSingleEmployeeOnObject
                            ? 'На объекте в эту смену только один сотрудник'
                            : undefined
                      }
                    >
                      {readOnly ? (
                        <span>{display}</span>
                      ) : (
                        <select
                          value={`${value.type}:${value.value}`}
                          onChange={(event) => {
                            if (!setCellValue) return;
                            const [type, raw] = event.target.value.split(':') as ['OBJECT' | 'SPECIAL', string];
                            if (type === 'OBJECT') {
                              setCellValue(employee.id, date, { type: 'OBJECT', value: raw });
                            } else {
                              setCellValue(employee.id, date, { type: 'SPECIAL', value: raw as SpecialValue });
                            }
                          }}
                        >
                          {objects
                            .filter((item) => item.active)
                            .map((objectItem) => (
                              <option key={objectItem.id} value={`OBJECT:${objectItem.id}`}>
                                {objectItem.short_ru || objectItem.name_ru}
                              </option>
                            ))}
                          <option disabled>────────</option>
                          {SPECIAL_OPTIONS.map((option) => (
                            <option key={option.value} value={`SPECIAL:${option.value}`}>
                              {option.description} ({option.label})
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
