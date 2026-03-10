import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ScheduleTable } from '../components/ScheduleTable';
import { dataService } from '../services/dataService';
import type { ScheduleEntry, SpecialValue } from '../types';
import { buildDateKey, daysInMonth, formatDateDmy } from '../utils/date';
import { exportMonthToXlsx } from '../utils/export';
import { coverageIssueToText, getCoverageIssues } from '../utils/coverage';
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
  const [employeeSearch, setEmployeeSearch] = useState('');
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
  ): { type: 'OBJECT'; value: string } | { type: 'SPECIAL'; value: SpecialValue } => {
    const entry = draftEntries[getEntryKey(employeeId, date)];
    if (!entry) return { type: 'SPECIAL', value: 'OFF' };
    if (entry.kind === 'OBJECT' && entry.object_id) return { type: 'OBJECT', value: entry.object_id };
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
      const anchorIndex = dates.indexOf(periodDate);
      if (anchorIndex < 0) return dates;
      const weekStart = Math.floor(anchorIndex / 7) * 7;
      return dates.slice(weekStart, weekStart + 7);
    }

    const fromIndex = dates.indexOf(customFromDate);
    const toIndex = dates.indexOf(customToDate);
    if (fromIndex < 0 || toIndex < 0) return dates;
    const [start, end] = fromIndex <= toIndex ? [fromIndex, toIndex] : [toIndex, fromIndex];
    return dates.slice(start, end + 1);
  }, [customFromDate, customToDate, dates, periodDate, periodMode]);

  const employeesByName = useMemo(
    () =>
      activeEmployees.filter((employee) =>
        employee.full_name.toLocaleLowerCase('ru-RU').includes(employeeSearch.trim().toLocaleLowerCase('ru-RU'))
      ),
    [activeEmployees, employeeSearch]
  );

  const employees = useMemo(() => {
    if (objectFilterIds.length === 0) return employeesByName;

    return employeesByName.filter((employee) =>
      periodDates.some((date) => {
        const cell = getDraftCellValue(employee.id, date);
        return cell.type === 'OBJECT' && objectFilterIds.includes(cell.value);
      })
    );
  }, [employeesByName, objectFilterIds, periodDates, draftEntries]);

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

  const workDaysByMechanic = useMemo(
    () =>
      employees.map((employee) => {
        const workDays = periodDates.reduce((total, date) => {
          const cell = getDraftCellValue(employee.id, date);
          return cell.type === 'OBJECT' ? total + 1 : total;
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
    setEmployeeSearch('');
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
        <input
          value={employeeSearch}
          onChange={(event) => setEmployeeSearch(event.target.value)}
          placeholder="Поиск сотрудника по имени"
        />
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

      {(employeeSearch || objectFilterIds.length > 0 || periodMode !== 'MONTH') && (
        <div className="filter-chips" aria-label="Активные фильтры">
          {employeeSearch && <span className="filter-chip">Имя: {employeeSearch}</span>}
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
            if (value.type === 'OBJECT') {
              return { ...current, [key]: { kind: 'OBJECT', object_id: value.value } };
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

      {coverageIssues.length > 0 && (
        <div className="notice notice-error">
          <strong>Проверка заполнения объектов:</strong>
          <ul>
            {coverageIssues.slice(0, 8).map((issue) => (
              <li key={issue.date}>{coverageIssueToText(issue)}</li>
            ))}
          </ul>
          {coverageIssues.length > 8 && <div>И еще {coverageIssues.length - 8} дн.</div>}
        </div>
      )}
    </section>
  );
};
