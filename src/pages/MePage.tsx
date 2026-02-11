import { useMemo, useState } from 'react';
import { ScheduleTable } from '../components/ScheduleTable';
import { dataService } from '../services/dataService';
import { MONTHS_2026 } from '../utils/constants';
import { coverageIssueToText, getCoverageIssues } from '../utils/coverage';
import { exportMonthToXlsx } from '../utils/export';
import { getSelectedAdminId } from '../utils/adminAuth';

export const MePage = (): JSX.Element => {
  const selectedAdminId = getSelectedAdminId();
  const [nameFilter, setNameFilter] = useState('');
  const [month, setMonth] = useState(1);

  const monthKey = `2026-${String(month).padStart(2, '0')}`;
  const monthData = dataService.getMonth(selectedAdminId, monthKey);
  const employeesByAdmin = dataService.getEmployeesByAdmin(selectedAdminId);
  const objectsByAdmin = dataService.getObjectsByAdmin(selectedAdminId);

  const visibleEmployees = useMemo(() => {
    const normalized = nameFilter.trim().toLocaleLowerCase('ru-RU');
    const active = employeesByAdmin.filter((employee) => employee.active);
    if (!normalized) return active;
    return active.filter((employee) => employee.full_name.toLocaleLowerCase('ru-RU').includes(normalized));
  }, [employeesByAdmin, nameFilter]);

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

      {monthData.status !== 'published' && <p>График еще не опубликован</p>}
      {monthData.status === 'published' && visibleEmployees.length === 0 && <p>Сотрудники не найдены.</p>}

      {monthData.status === 'published' && visibleEmployees.length > 0 && (
        <ScheduleTable
          year={2026}
          month={month}
          employees={visibleEmployees}
          objects={objectsByAdmin}
          readOnly
          getCellValue={(employeeId, date) => {
            const entry = dataService.getVisibleEntryForEmployee(selectedAdminId, monthKey, employeeId, date);
            if (!entry) return { type: 'SPECIAL', value: 'OFF' } as const;
            if (entry.kind === 'OBJECT' && entry.object_id) {
              return { type: 'OBJECT', value: entry.object_id } as const;
            }
            return { type: 'SPECIAL', value: entry.special ?? 'OFF' } as const;
          }}
        />
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
