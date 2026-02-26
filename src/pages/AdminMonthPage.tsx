import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ScheduleTable } from '../components/ScheduleTable';
import { dataService } from '../services/dataService';
import type { SpecialValue } from '../types';
import { buildDateKey, daysInMonth, formatDateDmy } from '../utils/date';
import { exportMonthToXlsx } from '../utils/export';
import { coverageIssueToText, getCoverageIssues } from '../utils/coverage';
import { getSelectedAdminId } from '../utils/adminAuth';
import { doesVacationIntersectMonth } from '../utils/vacation';

export const AdminMonthPage = (): JSX.Element => {
  const params = useParams<{ month: string }>();
  const month = Number(params.month ?? '1');
  const monthKey = `2026-${String(month).padStart(2, '0')}`;
  const selectedAdminId = getSelectedAdminId();
  const [tick, setTick] = useState(0);
  const [notice, setNotice] = useState<string>('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [dayFilter, setDayFilter] = useState('');
  const [objectFilter, setObjectFilter] = useState('ALL');

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

  const dates = useMemo(() => {
    const count = daysInMonth(2026, month);
    return Array.from({ length: count }, (_, idx) => buildDateKey(2026, month, idx + 1));
  }, [month, tick]);

  const employeesByName = useMemo(
    () =>
      activeEmployees.filter((employee) =>
        employee.full_name.toLocaleLowerCase('ru-RU').includes(employeeSearch.trim().toLocaleLowerCase('ru-RU'))
      ),
    [activeEmployees, employeeSearch]
  );

  const employees = useMemo(() => {
    if (objectFilter === 'ALL') return employeesByName;
    const datesToInspect = dayFilter && dates.includes(dayFilter) ? [dayFilter] : dates;
    return employeesByName.filter((employee) =>
      datesToInspect.some((date) => {
        const cell = dataService.getCellValue(selectedAdminId, monthKey, employee.id, date);
        return cell.type === 'OBJECT' && cell.value === objectFilter;
      })
    );
  }, [dates, dayFilter, employeesByName, monthKey, objectFilter, selectedAdminId, tick]);

  const coverageIssues = useMemo(
    () =>
      getCoverageIssues({
        year: 2026,
        month,
        employees: activeEmployees,
        objects,
        getCellValue: (employeeId, date) => dataService.getCellValue(selectedAdminId, monthKey, employeeId, date)
      }),
    [activeEmployees, month, monthKey, objects, selectedAdminId, tick]
  );

  const workDaysByMechanic = useMemo(
    () =>
      employees.map((employee) => {
        const workDays = dates.reduce((total, date) => {
          const cell = dataService.getCellValue(selectedAdminId, monthKey, employee.id, date);
          return cell.type === 'OBJECT' ? total + 1 : total;
        }, 0);

        return {
          id: employee.id,
          name: employee.full_name,
          workDays
        };
      }),
    [dates, employees, monthKey, selectedAdminId, tick]
  );

  const offMechanicsOnDate = useMemo(() => {
    if (!dayFilter || !dates.includes(dayFilter)) return [];
    return employees
      .filter((employee) => dataService.getCellValue(selectedAdminId, monthKey, employee.id, dayFilter).type === 'SPECIAL')
      .map((employee) => employee.full_name);
  }, [dates, dayFilter, employees, monthKey, selectedAdminId, tick]);

  const resetFilters = (): void => {
    setEmployeeSearch('');
    setObjectFilter('ALL');
    setDayFilter('');
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
        <select value={objectFilter} onChange={(event) => setObjectFilter(event.target.value)}>
          <option value="ALL">Все объекты</option>
          {objects.map((objectItem) => (
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
        <button type="button" onClick={resetFilters}>
          Сбросить фильтры
        </button>
        <button type="button" onClick={() => rerender('Сохранено')}>
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
            rerender('Месяц опубликован');
          }}
        >
          Опубликовать месяц
        </button>
        <button
          type="button"
          onClick={() => {
            dataService.setMonthStatus(selectedAdminId, monthKey, 'draft');
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
              getCellValue: (employeeId, date) => dataService.getCellValue(selectedAdminId, monthKey, employeeId, date)
            });
          }}
        >
          Выгрузить Excel (CSV)
        </button>
      </div>


      {(employeeSearch || objectFilter !== 'ALL' || dayFilter) && (
        <div className="filter-chips" aria-label="Активные фильтры">
          {employeeSearch && <span className="filter-chip">Имя: {employeeSearch}</span>}
          {objectFilter !== 'ALL' && (
            <span className="filter-chip">
              Объект: {objects.find((item) => item.id === objectFilter)?.short_ru || objects.find((item) => item.id === objectFilter)?.name_ru || '—'}
            </span>
          )}
          {dayFilter && <span className="filter-chip">Дата: {dayFilter}</span>}
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
        selectedDate={dayFilter || null}
        getCellValue={(employeeId, date) => dataService.getCellValue(selectedAdminId, monthKey, employeeId, date)}
        setCellValue={(employeeId, date, value) => {
          if (value.type === 'OBJECT') {
            dataService.setEntry(selectedAdminId, monthKey, employeeId, date, { kind: 'OBJECT', object_id: value.value });
          } else {
            dataService.setEntry(selectedAdminId, monthKey, employeeId, date, { kind: 'SPECIAL', special: value.value as SpecialValue });
          }
          setTick((x) => x + 1);
        }}
        clearCellValue={(employeeId, date) => {
          dataService.clearEntry(selectedAdminId, monthKey, employeeId, date);
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
                <div className="workload-bar">
                  <span style={{ width: `${Math.min(100, (item.workDays / dates.length) * 100)}%` }} />
                </div>
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
