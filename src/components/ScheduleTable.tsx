import { useMemo, useState } from 'react';
import type { Employee, SpecialValue, WorkObject } from '../types';
import { SPECIAL_LABELS, SPECIAL_OPTIONS, WEEKDAY_SHORT } from '../utils/constants';
import { buildDateKey, getWeekdayIndexMondayFirst } from '../utils/date';

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
  const dayCount = new Date(year, month, 0).getDate();
  const allDates = useMemo(
    () => Array.from({ length: dayCount }, (_, idx) => buildDateKey(year, month, idx + 1)),
    [dayCount, month, year]
  );

  const dates = useMemo(() => {
    if (!selectedDate) return allDates;
    return allDates.includes(selectedDate) ? [selectedDate] : allDates;
  }, [allDates, selectedDate]);

  const [selectionStart, setSelectionStart] = useState<{ row: number; col: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ row: number; col: number } | null>(null);
  const [massValue, setMassValue] = useState<string>('SPECIAL:OFF');

  const selectionBounds = useMemo(() => {
    if (!selectionStart || !selectionEnd) return null;
    return {
      rowMin: Math.min(selectionStart.row, selectionEnd.row),
      rowMax: Math.max(selectionStart.row, selectionEnd.row),
      colMin: Math.min(selectionStart.col, selectionEnd.col),
      colMax: Math.max(selectionStart.col, selectionEnd.col)
    };
  }, [selectionEnd, selectionStart]);

  const isSelected = (row: number, col: number): boolean => {
    if (!selectionBounds) return false;
    return row >= selectionBounds.rowMin && row <= selectionBounds.rowMax && col >= selectionBounds.colMin && col <= selectionBounds.colMax;
  };

  const applyToSelection = (): void => {
    if (!selectionBounds || !setCellValue) return;
    const [type, value] = massValue.split(':') as ['OBJECT' | 'SPECIAL', string];
    for (let r = selectionBounds.rowMin; r <= selectionBounds.rowMax; r += 1) {
      for (let c = selectionBounds.colMin; c <= selectionBounds.colMax; c += 1) {
        const employee = employees[r];
        const date = dates[c];
        if (!employee || !date) continue;
        if (type === 'OBJECT') {
          setCellValue(employee.id, date, { type: 'OBJECT', value });
        } else {
          setCellValue(employee.id, date, { type: 'SPECIAL', value: value as SpecialValue });
        }
      }
    }
  };

  const clearSelection = (): void => {
    if (!selectionBounds || !clearCellValue) return;
    for (let r = selectionBounds.rowMin; r <= selectionBounds.rowMax; r += 1) {
      for (let c = selectionBounds.colMin; c <= selectionBounds.colMax; c += 1) {
        const employee = employees[r];
        const date = dates[c];
        if (!employee || !date) continue;
        clearCellValue(employee.id, date);
      }
    }
  };

  return (
    <div>
      {!readOnly && (
        <div className="toolbar-row">
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
          <button type="button" onClick={applyToSelection}>
            Проставить выбранное
          </button>
          <button type="button" onClick={clearSelection}>
            Очистить выделенное
          </button>
        </div>
      )}

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
            {employees.map((employee, rowIndex) => (
              <tr key={employee.id}>
                <td className="sticky-col">{employee.full_name}</td>
                {dates.map((date, colIndex) => {
                  const value = getCellValue(employee.id, date);
                  const objectName = value.type === 'OBJECT' ? objects.find((item) => item.id === value.value)?.short_ru ?? '—' : '';
                  const display = value.type === 'OBJECT' ? objectName : SPECIAL_LABELS[value.value];

                  return (
                    <td
                      key={date}
                      className={isSelected(rowIndex, colIndex) ? 'selected' : ''}
                      onMouseDown={() => !readOnly && setSelectionStart({ row: rowIndex, col: colIndex })}
                      onMouseEnter={() => !readOnly && selectionStart && setSelectionEnd({ row: rowIndex, col: colIndex })}
                      onMouseUp={() => !readOnly && setSelectionEnd({ row: rowIndex, col: colIndex })}
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
