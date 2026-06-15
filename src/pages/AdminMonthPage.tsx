import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ScheduleTable } from '../components/ScheduleTable';
import { dataService } from '../services/dataService';
import type { CellValue, ScheduleEntry, SpecialValue } from '../types';
import { buildDateKey, daysInMonth, formatDateDmy, getWeekDatesMondayFirst } from '../utils/date';
import { exportMonthToXlsx } from '../utils/export';
import { coverageObjectStatusToText, getCoverageIssues, getCoverageStatusByObject } from '../utils/coverage';
import { getSelectedAdminId } from '../utils/adminAuth';
import { doesVacationIntersectMonth } from '../utils/vacation';

type PeriodMode = 'MONTH' | 'DAY' | 'WEEK' | 'CUSTOM';

export const AdminMonthPage = (): JSX.Element => {
  const params = useParams<{ month: string }>();
  const month = Number(params.month ?? '1');
  const monthKey = `2026-${String(month).padStart(2, '0')}`;
  const selectedAdminId = getSelectedAdminId();
  const [tick, setTick] = useState(0);
  const [notice, setNotice] = useState<string>('');
  const [employeeFilterIds, setEmployeeFilterIds] = useState<string[]>([]);
  const [periodMode, setPeriodMode] = useState<PeriodMode>('MONTH');
  const [periodDate, setPeriodDate] = useState('');
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');
  const [objectFilterIds, setObjectFilterIds] = useState<string[]>([]);
  const [draftEntries, setDraftEntries] = useState<Record<string, ScheduleEntry>>({});

  const getEntryKey = (employeeId: string, date: string): string => `${employeeId}_${date}`;

  const loadDraftEntries = (): void => {
    const latestMonth = dataService.getMonth(selectedAdminId, monthKey);
    setDraftEntries(structuredClone(latestMonth.entries));
  };

  useEffect(() => {
    loadDraftEntries();
  }, [monthKey, selectedAdminId]);

  const activeEmployees = dataService.getEmployeesByAdmin(selectedAdminId).filter((employee) => employee.active);
  const objects = dataService.getObjectsByAdmin(selectedAdminId);
  const monthData = dataService.getMonth(selectedAdminId, monthKey);
  const vacationRequestsInMonth = dataService
    .getVacationRequestsByAdmin(selectedAdminId)
    .filter((request) => doesVacationIntersectMonth(request.start_date, request.end_date, monthKey))
    .map((request) => ({
      ...request,
      employeeName: activeEmployees.find((employee) => employee.id === request.employee_id)?.full_name ?? 'Сотрудник удален'
    }));

  const getDraftCellValue = (
    employeeId: string,
    date: string
  ): CellValue => {
    const entry = draftEntries[getEntryKey(employeeId, date)];
    if (!entry) return { type: 'SPECIAL', value: 'OFF' };
    if (entry.kind === 'OBJECT' && entry.object_id) {
      return {
        type: entry.object_role === 'ADMINISTRATOR' ? 'ADMINISTRATOR' : 'OBJECT',
        value: entry.object_id
      };
    }
    return { type: 'SPECIAL', value: entry.special ?? 'OFF' };
  };

  const dates = useMemo(() => {
    const count = daysInMonth(2026, month);
    return Array.from({ length: count }, (_, idx) => buildDateKey(2026, month, idx + 1));
  }, [month, tick]);

  useEffect(() => {
    const firstDate = dates[0] ?? '';
    const lastDate = dates[dates.length - 1] ?? '';
    setPeriodDate(firstDate);
    setCustomFromDate(firstDate);
    setCustomToDate(lastDate);
  }, [dates]);

  const periodDates = useMemo(() => {
    if (dates.length === 0) return [] as string[];
    if (periodMode === 'MONTH') return dates;

    if (periodMode === 'DAY') {
      return dates.includes(periodDate) ? [periodDate] : dates;
    }

    if (periodMode === 'WEEK') {
      return getWeekDatesMondayFirst(dates, periodDate);
    }

    const fromIndex = dates.indexOf(customFromDate);
    const toIndex = dates.indexOf(customToDate);
    if (fromIndex < 0 || toIndex < 0) return dates;
    const [start, end] = fromIndex <= toIndex ? [fromIndex, toIndex] : [toIndex, fromIndex];
    return dates.slice(start, end + 1);
  }, [customFromDate, customToDate, dates, periodDate, periodMode]);

  const employeesByFilter = useMemo(() => {
    if (employeeFilterIds.length === 0) return activeEmployees;
    return activeEmployees.filter((employee) => employeeFilterIds.includes(employee.id));
  }, [activeEmployees, employeeFilterIds]);

  const employees = useMemo(() => {
    if (objectFilterIds.length === 0) return employeesByFilter;

    return employeesByFilter.filter((employee) =>
      periodDates.some((date) => {
        const cell = getDraftCellValue(employee.id, date);
        return (cell.type === 'OBJECT' || cell.type === 'ADMINISTRATOR') && objectFilterIds.includes(cell.value);
      })
    );
  }, [employeesByFilter, objectFilterIds, periodDates, draftEntries]);

  const coverageIssues = useMemo(
    () =>
      getCoverageIssues({
        year: 2026,
        month,
        employees: activeEmployees,
        objects,
        getCellValue: (employeeId, date) => getDraftCellValue(employeeId, date)
      }),
    [activeEmployees, month, objects, draftEntries]
  );

  const coverageStatusByObject = useMemo(
    () => getCoverageStatusByObject(objects, coverageIssues),
    [coverageIssues, objects],
  );

  const workDaysByMechanic = useMemo(
    () =>
      employees.map((employee) => {
        const workDays = periodDates.reduce((total, date) => {
          const cell = getDraftCellValue(employee.id, date);
          return cell.type === 'OBJECT' || cell.type === 'ADMINISTRATOR' ? total + 1 : total;
        }, 0);

        return {
          id: employee.id,
          name: employee.full_name,
          workDays
        };
      }),
    [employees, periodDates, draftEntries]
  );

  const focusDate = periodMode === 'DAY' && periodDates.length > 0 ? periodDates[0] : '';

  const offMechanicsOnDate = useMemo(() => {
    if (!focusDate) return [];
    return employees.filter((employee) => getDraftCellValue(employee.id, focusDate).type === 'SPECIAL').map((employee) => employee.full_name);
  }, [employees, focusDate, draftEntries]);

  const resetFilters = (): void => {
    setEmployeeFilterIds([]);
    setObjectFilterIds([]);
    setPeriodMode('MONTH');
    setPeriodDate(dates[0] ?? '');
    setCustomFromDate(dates[0] ?? '');
    setCustomToDate(dates[dates.length - 1] ?? '');
  };

  const rerender = (message: string): void => {
    setTick((value) => value + 1);
    setNotice(message);
    setTimeout(() => setNotice(''), 1800);
  };

  return (
    <section>
      <h1>График {String(month).padStart(2, '0')}.2026</h1>
      <p>Статус: {monthData.status === 'published' ? 'Опубликован' : 'Черновик'}</p>
      {notice && <div className="notice">{notice}</div>}
      {vacationRequestsInMonth.length > 0 && (
        <div className="notice notice-error">
          <strong>Внимание: на этот месяц уже внесены отпуска сотрудниками.</strong>
          <ul>
            {vacationRequestsInMonth.map((request) => (
              <li key={request.id}>
                {request.employeeName}: {formatDateDmy(request.start_date)} — {formatDateDmy(request.end_date)} ({request.vacation_days} дн.)
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="toolbar-row sticky-actions">
        <div className="multi-select-filter">
          <label htmlFor="employee-filter">Сотрудники</label>
          <select
            id="employee-filter"
            className="multi-select"
            multiple
            size={1}
            value={employeeFilterIds}
            onChange={(event) =>
              setEmployeeFilterIds(Array.from(event.target.selectedOptions, (option) => option.value))
            }
          >
            {activeEmployees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.full_name}
              </option>
            ))}
          </select>
        </div>
        <select value={periodMode} onChange={(event) => setPeriodMode(event.target.value as PeriodMode)}>
          <option value="MONTH">Период: месяц</option>
          <option value="WEEK">Период: неделя</option>
          <option value="DAY">Период: день</option>
          <option value="CUSTOM">Период: произвольный</option>
        </select>
        {(periodMode === 'DAY' || periodMode === 'WEEK') && (
          <input
            type="date"
            min={`2026-${String(month).padStart(2, '0')}-01`}
            max={`2026-${String(month).padStart(2, '0')}-31`}
            value={periodDate}
            onChange={(event) => setPeriodDate(event.target.value)}
          />
        )}
        {periodMode === 'CUSTOM' && (
          <>
            <input
              type="date"
              min={`2026-${String(month).padStart(2, '0')}-01`}
              max={`2026-${String(month).padStart(2, '0')}-31`}
              value={customFromDate}
              onChange={(event) => setCustomFromDate(event.target.value)}
            />
            <input
              type="date"
              min={`2026-${String(month).padStart(2, '0')}-01`}
              max={`2026-${String(month).padStart(2, '0')}-31`}
              value={customToDate}
              onChange={(event) => setCustomToDate(event.target.value)}
            />
          </>
        )}
        <div className="multi-select-filter">
          <label htmlFor="object-filter">Объекты</label>
          <select
            id="object-filter"
            className="multi-select"
            multiple
            size={1}
            value={objectFilterIds}
            onChange={(event) =>
              setObjectFilterIds(Array.from(event.target.selectedOptions, (option) => option.value))
            }
          >
            {objects.map((objectItem) => (
              <option key={objectItem.id} value={objectItem.id}>
                {objectItem.short_ru || objectItem.name_ru}
              </option>
            ))}
          </select>
        </div>
        <button type="button" onClick={resetFilters}>
          Сбросить фильтры
        </button>
        <button
          type="button"
          onClick={() => {
            dataService.replaceMonthEntries(selectedAdminId, monthKey, draftEntries);
            loadDraftEntries();
            rerender('Сохранено');
          }}
        >
          Сохранить
        </button>
        <button
          type="button"
          onClick={() => {
            dataService.publishMonth(
              selectedAdminId,
              monthKey,
              dates,
              activeEmployees.map((employee) => employee.id)
            );
            loadDraftEntries();
            rerender('Месяц опубликован');
          }}
        >
          Опубликовать месяц
        </button>
        <button
          type="button"
          onClick={() => {
            dataService.setMonthStatus(selectedAdminId, monthKey, 'draft');
            loadDraftEntries();
            rerender('Публикация снята');
          }}
        >
          Снять публикацию
        </button>
        <button
          type="button"
          onClick={() => {
            const copied = dataService.extendMonthFromPrevious(
              selectedAdminId,
              monthKey,
              activeEmployees.map((employee) => employee.id)
            );
            if (copied) {
              loadDraftEntries();
              rerender('График протянут из прошлого месяца');
            } else {
              setNotice('Нет данных за прошлый месяц для протяжки');
              setTimeout(() => setNotice(''), 2200);
            }
          }}
        >
          Протянуть из прошлого месяца
        </button>
        <button
          type="button"
          onClick={() => {
            exportMonthToXlsx({
              year: 2026,
              month,
              employees,
              objects,
              getCellValue: (employeeId, date) => getDraftCellValue(employeeId, date)
            });
          }}
        >
          Выгрузить Excel (CSV)
        </button>
      </div>

      {(employeeFilterIds.length > 0 || objectFilterIds.length > 0 || periodMode !== 'MONTH') && (
        <div className="filter-chips" aria-label="Активные фильтры">
          {employeeFilterIds.length > 0 && (
            <span className="filter-chip">
              Сотрудники: {employeeFilterIds
                .map((id) => activeEmployees.find((employee) => employee.id === id)?.full_name)
                .filter(Boolean)
                .join(', ')}
            </span>
          )}
          {objectFilterIds.length > 0 && (
            <span className="filter-chip">
              Объекты: {objectFilterIds
                .map((id) => objects.find((item) => item.id === id)?.short_ru || objects.find((item) => item.id === id)?.name_ru)
                .filter(Boolean)
                .join(', ')}
            </span>
          )}
          {periodMode !== 'MONTH' && <span className="filter-chip">Период: {periodMode === 'DAY' ? 'День' : periodMode === 'WEEK' ? 'Неделя' : 'Произвольный'}</span>}
        </div>
      )}

      {employees.length === 0 && (
        <div className="notice notice-error">
          По текущим фильтрам сотрудники не найдены.
          <div>
            <button type="button" onClick={resetFilters}>Показать всех сотрудников</button>
          </div>
        </div>
      )}

      <ScheduleTable
        year={2026}
        month={month}
        employees={employees}
        objects={objects}
        visibleDates={periodDates}
        getCellValue={(employeeId, date) => getDraftCellValue(employeeId, date)}
        setCellValue={(employeeId, date, value) => {
          setDraftEntries((current) => {
            const key = getEntryKey(employeeId, date);
            if (value.type === 'OBJECT' || value.type === 'ADMINISTRATOR') {
              return {
                ...current,
                [key]: {
                  kind: 'OBJECT',
                  object_id: value.value,
                  ...(value.type === 'ADMINISTRATOR' ? { object_role: 'ADMINISTRATOR' as const } : {})
                }
              };
            }
            return { ...current, [key]: { kind: 'SPECIAL', special: value.value as SpecialValue } };
          });
          setTick((x) => x + 1);
        }}
        clearCellValue={(employeeId, date) => {
          setDraftEntries((current) => {
            const key = getEntryKey(employeeId, date);
            if (!current[key]) return current;
            const next = { ...current };
            delete next[key];
            return next;
          });
          setTick((x) => x + 1);
        }}
      />

      <div className="summary-grid">
        <div className="summary-card">
          <h3>Рабочие дни механиков</h3>
          <ul>
            {workDaysByMechanic.map((item) => (
              <li key={item.id}>
                <strong>{item.name}</strong>: {item.workDays} дн.
              </li>
            ))}
          </ul>
        </div>

        <div className="summary-card">
          <h3>Кто выходной в выбранную дату</h3>
          {periodMode !== 'DAY' && <p>Для этой карточки выберите режим периода «День».</p>}
          {periodMode === 'DAY' && offMechanicsOnDate.length === 0 && <p>На {focusDate} выходных нет.</p>}
          {periodMode === 'DAY' && offMechanicsOnDate.length > 0 && (
            <ul>
              {offMechanicsOnDate.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {coverageStatusByObject.length > 0 && (
        <div className={`notice coverage-status ${coverageIssues.length > 0 ? 'notice-error' : ''}`.trim()}>
          <strong>Проверка заполнения объектов:</strong>
          <div className="coverage-status-list">
            {coverageStatusByObject.map((status) => (
              <div
                key={status.object.id}
                className={`coverage-status-item ${status.missingDates.length > 0 ? 'coverage-status-item-error' : 'coverage-status-item-ok'}`}
              >
                {coverageObjectStatusToText(status)}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
