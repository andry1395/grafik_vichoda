import { useMemo, useState } from 'react';
import { ScheduleTable } from '../components/ScheduleTable';
import { dataService } from '../services/dataService';
import { MONTHS_2026 } from '../utils/constants';
import { buildDateKey, daysInMonth, formatDateRu } from '../utils/date';

export const MePage = (): JSX.Element => {
  const appData = dataService.getAppData();
  const [nameFilter, setNameFilter] = useState('');
  const [month, setMonth] = useState(1);

  const monthKey = `2026-${String(month).padStart(2, '0')}`;
  const monthData = dataService.getMonth(monthKey);

  const visibleEmployees = useMemo(() => {
    const normalized = nameFilter.trim().toLocaleLowerCase('ru-RU');
    const active = appData.employees.filter((employee) => employee.active);
    if (!normalized) return active;
    return active.filter((employee) => employee.full_name.toLocaleLowerCase('ru-RU').includes(normalized));
  }, [appData.employees, nameFilter]);

  const offDaysByEmployee = useMemo(() => {
    const result: Record<string, string[]> = {};
    if (monthData.status !== 'published') return result;

    for (const employee of visibleEmployees) {
      const items: string[] = [];
      const dayCount = daysInMonth(2026, month);
      for (let day = 1; day <= dayCount; day += 1) {
        const date = buildDateKey(2026, month, day);
        const entry = dataService.getVisibleEntryForEmployee(monthKey, employee.id, date);
        if (!entry || (entry.kind === 'SPECIAL' && entry.special === 'OFF')) {
          items.push(formatDateRu(date));
        }
      }
      result[employee.id] = items;
    }

    return result;
  }, [month, monthData.status, monthKey, visibleEmployees]);

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
      </div>

      {monthData.status !== 'published' && <p>График еще не опубликован</p>}
      {monthData.status === 'published' && visibleEmployees.length === 0 && <p>Сотрудники не найдены.</p>}

      {monthData.status === 'published' && visibleEmployees.length > 0 && (
        <>
          <ScheduleTable
            year={2026}
            month={month}
            employees={visibleEmployees}
            objects={appData.objects}
            readOnly
            getCellValue={(employeeId, date) => {
              const entry = dataService.getVisibleEntryForEmployee(monthKey, employeeId, date);
              if (!entry) return { type: 'SPECIAL', value: 'OFF' } as const;
              if (entry.kind === 'OBJECT' && entry.object_id) {
                return { type: 'OBJECT', value: entry.object_id } as const;
              }
              return { type: 'SPECIAL', value: entry.special ?? 'OFF' } as const;
            }}
          />

          <h2>Выходные по сотрудникам</h2>
          <ul>
            {visibleEmployees.map((employee) => (
              <li key={employee.id}>
                <strong>{employee.full_name}:</strong>{' '}
                {offDaysByEmployee[employee.id]?.length ? offDaysByEmployee[employee.id].join(', ') : 'нет'}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
};
