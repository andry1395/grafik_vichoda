import { useEffect, useMemo, useState } from 'react';
import { ScheduleTable } from '../components/ScheduleTable';
import { dataService } from '../services/dataService';
import { MONTHS_2026 } from '../utils/constants';
import { coverageObjectStatusToText, getCoverageIssues, getCoverageStatusByObject } from '../utils/coverage';
import { exportMonthToXlsx } from '../utils/export';
import { getSelectedAdminId } from '../utils/adminAuth';
import { buildDateKey, daysInMonth, getWeekDatesMondayFirst } from '../utils/date';

const currentMonthNumber = (): number => {
  const current = new Date().getMonth() + 1;
  return current >= 1 && current <= 12 ? current : 1;
};

type PeriodMode = 'MONTH' | 'DAY' | 'WEEK' | 'CUSTOM';

export const MePage = (): JSX.Element => {
  const selectedAdminId = getSelectedAdminId();
  const [employeeFilterIds, setEmployeeFilterIds] = useState<string[]>([]);
  const [month, setMonth] = useState(currentMonthNumber());
  const [periodMode, setPeriodMode] = useState<PeriodMode>('MONTH');
  const [periodDate, setPeriodDate] = useState('');
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');
  const [objectFilterIds, setObjectFilterIds] = useState<string[]>([]);

  const monthKey = `2026-${String(month).padStart(2, '0')}`;
  const monthData = dataService.getMonth(selectedAdminId, monthKey);
  const employeesByAdmin = dataService.getEmployeesByAdmin(selectedAdminId);
  const objectsByAdmin = dataService.getObjectsByAdmin(selectedAdminId);

  const dates = useMemo(() => {
    const count = daysInMonth(2026, month);
    return Array.from({ length: count }, (_, idx) => buildDateKey(2026, month, idx + 1));
  }, [month]);

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

  const activeEmployees = useMemo(() => employeesByAdmin.filter((employee) => employee.active), [employeesByAdmin]);

  const visibleEmployeesByFilter = useMemo(() => {
    if (employeeFilterIds.length === 0) return activeEmployees;
    return activeEmployees.filter((employee) => employeeFilterIds.includes(employee.id));
  }, [activeEmployees, employeeFilterIds]);

  const visibleEmployees = useMemo(() => {
    if (objectFilterIds.length === 0) return visibleEmployeesByFilter;

    return visibleEmployeesByFilter.filter((employee) =>
      periodDates.some((date) => {
        const entry = dataService.getVisibleEntryForEmployee(selectedAdminId, monthKey, employee.id, date);
        if (entry?.kind !== 'OBJECT' || !entry.object_id) return false;
        return objectFilterIds.includes(entry.object_id);
      })
    );
  }, [monthKey, objectFilterIds, periodDates, selectedAdminId, visibleEmployeesByFilter]);

  const coverageIssues = useMemo(
    () =>
      getCoverageIssues({
        year: 2026,
        month,
        employees: activeEmployees,
        objects: objectsByAdmin,
        getCellValue: (employeeId, date) => dataService.getCellValue(selectedAdminId, monthKey, employeeId, date)
      }),
    [activeEmployees, month, monthKey, objectsByAdmin, selectedAdminId]
  );

  const coverageStatusByObject = useMemo(
    () => getCoverageStatusByObject(objectsByAdmin, coverageIssues),
    [objectsByAdmin, coverageIssues],
  );

  const workDaysByMechanic = useMemo(() => {
    if (monthData.status !== 'published') return [];
    return visibleEmployees.map((employee) => {
      const workDays = periodDates.reduce((total, date) => {
        const entry = dataService.getVisibleEntryForEmployee(selectedAdminId, monthKey, employee.id, date);
        return entry?.kind === 'OBJECT' ? total + 1 : total;
      }, 0);

      return {
        id: employee.id,
        name: employee.full_name,
        workDays
      };
    });
  }, [monthData.status, monthKey, periodDates, selectedAdminId, visibleEmployees]);

  const focusDate = periodMode === 'DAY' && periodDates.length > 0 ? periodDates[0] : '';

  const offMechanicsOnDate = useMemo(() => {
    if (monthData.status !== 'published' || !focusDate) return [];
    return visibleEmployees
      .filter((employee) => {
        const entry = dataService.getVisibleEntryForEmployee(selectedAdminId, monthKey, employee.id, focusDate);
        return entry?.kind === 'SPECIAL';
      })
      .map((employee) => employee.full_name);
  }, [focusDate, monthData.status, monthKey, selectedAdminId, visibleEmployees]);

  const resetFilters = (): void => {
    setEmployeeFilterIds([]);
    setObjectFilterIds([]);
    setPeriodMode('MONTH');
    setPeriodDate(dates[0] ?? '');
    setCustomFromDate(dates[0] ?? '');
    setCustomToDate(dates[dates.length - 1] ?? '');
  };

  return (
    <section>
      <h1>Страница сотрудников (просмотр)</h1>
      <p>Здесь можно просматривать график свой и коллег. Редактирование недоступно.</p>

      <div className="toolbar-row">
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
        <select value={month} onChange={(event) => setMonth(Number(event.target.value))}>
          {MONTHS_2026.map((value) => (
            <option key={value} value={value}>
              {String(value).padStart(2, '0')}.2026
            </option>
          ))}
        </select>
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
            {objectsByAdmin.map((objectItem) => (
              <option key={objectItem.id} value={objectItem.id}>
                {objectItem.short_ru || objectItem.name_ru}
              </option>
            ))}
          </select>
        </div>
        <button type="button" onClick={resetFilters}>Сбросить фильтры</button>
        <button
          type="button"
          onClick={() => {
            exportMonthToXlsx({
              year: 2026,
              month,
              employees: visibleEmployees,
              objects: objectsByAdmin,
              getCellValue: (employeeId, date) => dataService.getCellValue(selectedAdminId, monthKey, employeeId, date)
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
                .map((id) => objectsByAdmin.find((item) => item.id === id)?.short_ru || objectsByAdmin.find((item) => item.id === id)?.name_ru)
                .filter(Boolean)
                .join(', ')}
            </span>
          )}
          {periodMode !== 'MONTH' && <span className="filter-chip">Период: {periodMode === 'DAY' ? 'День' : periodMode === 'WEEK' ? 'Неделя' : 'Произвольный'}</span>}
        </div>
      )}

      {monthData.status !== 'published' && <p>График еще не опубликован</p>}
      {monthData.status === 'published' && visibleEmployees.length === 0 && (
        <div className="notice notice-error">
          Сотрудники не найдены по текущим фильтрам.
          <div>
            <button type="button" onClick={resetFilters}>Показать всех</button>
          </div>
        </div>
      )}

      {monthData.status === 'published' && visibleEmployees.length > 0 && (
        <>
          <ScheduleTable
            year={2026}
            month={month}
            employees={visibleEmployees}
            objects={objectsByAdmin}
            readOnly
            visibleDates={periodDates}
            getCellValue={(employeeId, date) => {
              const entry = dataService.getVisibleEntryForEmployee(selectedAdminId, monthKey, employeeId, date);
              if (!entry) return { type: 'SPECIAL', value: 'OFF' } as const;
              if (entry.kind === 'OBJECT' && entry.object_id) {
                return { type: 'OBJECT', value: entry.object_id } as const;
              }
              return { type: 'SPECIAL', value: entry.special ?? 'OFF' } as const;
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
        </>
      )}

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
