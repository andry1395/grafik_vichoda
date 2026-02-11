import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ScheduleTable } from '../components/ScheduleTable';
import { dataService } from '../services/dataService';
import { MONTHS_2026 } from '../utils/constants';
import { buildDateKey, daysInMonth, formatDateRu } from '../utils/date';

export const MePage = (): JSX.Element => {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const monthParam = Number(params.get('month') ?? '1');
  const month = monthParam >= 1 && monthParam <= 12 ? monthParam : 1;
  const monthKey = `2026-${String(month).padStart(2, '0')}`;

  const appData = dataService.getAppData();
  const [nameSearch, setNameSearch] = useState('');
  const [monthSearch, setMonthSearch] = useState(month);

  const monthForSearch = `2026-${String(monthSearch).padStart(2, '0')}`;

  const employeeFromToken = useMemo(() => dataService.getEmployeeByToken(token), [token]);
  const searchedEmployee = useMemo(
    () =>
      appData.employees.find(
        (employee) =>
          employee.active && employee.full_name.toLocaleLowerCase('ru-RU') === nameSearch.trim().toLocaleLowerCase('ru-RU')
      ),
    [appData.employees, nameSearch]
  );

  const employee = token ? employeeFromToken : searchedEmployee;
  const selectedMonthKey = token ? monthKey : monthForSearch;
  const monthData = dataService.getMonth(selectedMonthKey);

  const offDays = useMemo(() => {
    if (!employee || monthData.status !== 'published') return [] as string[];
    const dayCount = daysInMonth(2026, token ? month : monthSearch);
    const result: string[] = [];
    for (let day = 1; day <= dayCount; day += 1) {
      const date = buildDateKey(2026, token ? month : monthSearch, day);
      const entry = dataService.getVisibleEntryForEmployee(selectedMonthKey, employee.id, date);
      if (!entry || (entry.kind === 'SPECIAL' && entry.special === 'OFF')) {
        result.push(formatDateRu(date));
      }
    }
    return result;
  }, [employee, monthData.status, monthSearch, month, selectedMonthKey, token]);

  if (token && !employee) return <p>Сотрудник не найден или деактивирован.</p>;

  return (
    <section>
      <h1>Просмотр графика сотрудника</h1>

      {!token && (
        <div className="toolbar-row">
          <input
            value={nameSearch}
            onChange={(event) => setNameSearch(event.target.value)}
            placeholder="Введите Фамилия Имя"
          />
          <select value={monthSearch} onChange={(event) => setMonthSearch(Number(event.target.value))}>
            {MONTHS_2026.map((value) => (
              <option key={value} value={value}>
                {String(value).padStart(2, '0')}.2026
              </option>
            ))}
          </select>
        </div>
      )}

      {!employee && <p>Введите точное Фамилия Имя, чтобы увидеть только свой график.</p>}
      {employee && monthData.status !== 'published' && <p>График еще не опубликован</p>}

      {employee && monthData.status === 'published' && (
        <>
          <p>
            Сотрудник: {employee.full_name} · Месяц: {selectedMonthKey.slice(5)}.2026
          </p>
          <p>
            Выходные: {offDays.length > 0 ? offDays.join(', ') : 'нет'}
          </p>
          <ScheduleTable
            year={2026}
            month={token ? month : monthSearch}
            employees={[employee]}
            objects={appData.objects}
            readOnly
            getCellValue={(employeeId, date) => {
              const entry = dataService.getVisibleEntryForEmployee(selectedMonthKey, employeeId, date);
              if (!entry) return { type: 'SPECIAL', value: 'OFF' } as const;
              if (entry.kind === 'OBJECT' && entry.object_id) {
                return { type: 'OBJECT', value: entry.object_id } as const;
              }
              return { type: 'SPECIAL', value: entry.special ?? 'OFF' } as const;
            }}
          />
        </>
      )}
    </section>
  );
};
