import { useMemo, useState } from 'react';
import { ScheduleTable } from '../components/ScheduleTable';
import { dataService } from '../services/dataService';
import { MONTHS_2026 } from '../utils/constants';
import { coverageIssueToText, getCoverageIssues } from '../utils/coverage';
import { exportMonthToXlsx } from '../utils/export';
import { getSelectedAdminId } from '../utils/adminAuth';
import { buildDateKey, daysInMonth } from '../utils/date';

const currentMonthNumber = (): number => {
  const current = new Date().getMonth() + 1;
  return current >= 1 && current <= 12 ? current : 1;
};

export const MePage = (): JSX.Element => {
  const selectedAdminId = getSelectedAdminId();
  const [nameFilter, setNameFilter] = useState('');
  const [month, setMonth] = useState(currentMonthNumber());
  const [dayFilter, setDayFilter] = useState('');
  const [objectFilterIds, setObjectFilterIds] = useState<string[]>([]);

  const monthKey = `2026-${String(month).padStart(2, '0')}`;
  const monthData = dataService.getMonth(selectedAdminId, monthKey);
  const employeesByAdmin = dataService.getEmployeesByAdmin(selectedAdminId);
  const objectsByAdmin = dataService.getObjectsByAdmin(selectedAdminId);

  const dates = useMemo(() => {
    const count = daysInMonth(2026, month);
    return Array.from({ length: count }, (_, idx) => buildDateKey(2026, month, idx + 1));
  }, [month]);

  const visibleEmployeesByName = useMemo(() => {
    const normalized = nameFilter.trim().toLocaleLowerCase('ru-RU');
    const active = employeesByAdmin.filter((employee) => employee.active);
    if (!normalized) return active;
    return active.filter((employee) => employee.full_name.toLocaleLowerCase('ru-RU').includes(normalized));
  }, [employeesByAdmin, nameFilter]);

  const visibleEmployees = useMemo(() => {
    if (objectFilterIds.length === 0) return visibleEmployeesByName;
    const datesToInspect = dayFilter && dates.includes(dayFilter) ? [dayFilter] : dates;

    return visibleEmployeesByName.filter((employee) =>
      datesToInspect.some((date) => {
        const entry = dataService.getVisibleEntryForEmployee(selectedAdminId, monthKey, employee.id, date);
        if (entry?.kind !== 'OBJECT' || !entry.object_id) return false;
        return objectFilterIds.includes(entry.object_id);
      })
    );
  }, [dates, dayFilter, monthKey, objectFilterIds, selectedAdminId, visibleEmployeesByName]);

  const coverageIssues = useMemo(
    () =>
      getCoverageIssues({
        year: 2026,
        month,
        employees: employeesByAdmin.filter((employee) => employee.active),
        objects: objectsByAdmin,
        getCellValue: (employeeId, date) => dataService.getCellValue(selectedAdminId, monthKey, employeeId, date)
      }),
    [employeesByAdmin, month, monthKey, objectsByAdmin, selectedAdminId]
  );

  const workDaysByMechanic = useMemo(() => {
    if (monthData.status !== 'published') return [];
    return visibleEmployees.map((employee) => {
      const workDays = dates.reduce((total, date) => {
        const entry = dataService.getVisibleEntryForEmployee(selectedAdminId, monthKey, employee.id, date);
        return entry?.kind === 'OBJECT' ? total + 1 : total;
      }, 0);

      return {
        id: employee.id,
        name: employee.full_name,
        workDays
      };
    });
  }, [dates, monthData.status, monthKey, selectedAdminId, visibleEmployees]);

  const offMechanicsOnDate = useMemo(() => {
    if (monthData.status !== 'published' || !dayFilter || !dates.includes(dayFilter)) return [];
    return visibleEmployees
      .filter((employee) => {
        const entry = dataService.getVisibleEntryForEmployee(selectedAdminId, monthKey, employee.id, dayFilter);
        return entry?.kind === 'SPECIAL';
      })
      .map((employee) => employee.full_name);
  }, [dates, dayFilter, monthData.status, monthKey, selectedAdminId, visibleEmployees]);

  const resetFilters = (): void => {
    setNameFilter('');
    setObjectFilterIds([]);
    setDayFilter('');
  };

  return (
    <section>
      <h1>Страница сотрудников (просмотр)</h1>
      <p>Здесь можно просматривать график свой и коллег. Редактирование недоступно.</p>

      <div className="toolbar-row">
        <input
          value={nameFilter}
          onChange={(event) => setNameFilter(event.target.value)}
          placeholder="Поиск сотрудника (можно часть ФИО)"
        />
        <select value={month} onChange={(event) => setMonth(Number(event.target.value))}>
          {MONTHS_2026.map((value) => (
            <option key={value} value={value}>
              {String(value).padStart(2, '0')}.2026
            </option>
          ))}
        </select>
        <select
          multiple
          value={objectFilterIds}
          onChange={(event) =>
            setObjectFilterIds(Array.from(event.target.selectedOptions, (option) => option.value))
          }
          title="Можно выбрать несколько объектов (Ctrl/Cmd + клик)"
        >
          {objectsByAdmin.map((objectItem) => (
            <option key={objectItem.id} value={objectItem.id}>
              {objectItem.short_ru || objectItem.name_ru}
            </option>
          ))}
        </select>
        <input
          type="date"
          min={`2026-${String(month).padStart(2, '0')}-01`}
          max={`2026-${String(month).padStart(2, '0')}-31`}
          value={dayFilter}
          onChange={(event) => setDayFilter(event.target.value)}
          placeholder="Дата"
        />
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


      {(nameFilter || objectFilterIds.length > 0 || dayFilter) && (
        <div className="filter-chips" aria-label="Активные фильтры">
          {nameFilter && <span className="filter-chip">Имя: {nameFilter}</span>}
          {objectFilterIds.length > 0 && (
            <span className="filter-chip">
              Объекты: {objectFilterIds
                .map((id) => objectsByAdmin.find((item) => item.id === id)?.short_ru || objectsByAdmin.find((item) => item.id === id)?.name_ru)
                .filter(Boolean)
                .join(', ')}
            </span>
          )}
          {dayFilter && <span className="filter-chip">Дата: {dayFilter}</span>}
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
            selectedDate={dayFilter || null}
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
              {!dayFilter && <p>Выберите дату в фильтре выше.</p>}
              {dayFilter && offMechanicsOnDate.length === 0 && <p>На {dayFilter} выходных нет.</p>}
              {dayFilter && offMechanicsOnDate.length > 0 && (
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
