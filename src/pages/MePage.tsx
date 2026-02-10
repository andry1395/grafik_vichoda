import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ScheduleTable } from '../components/ScheduleTable';
import { dataService } from '../services/dataService';

export const MePage = (): JSX.Element => {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const monthParam = Number(params.get('month') ?? '1');
  const month = monthParam >= 1 && monthParam <= 12 ? monthParam : 1;
  const monthKey = `2026-${String(month).padStart(2, '0')}`;

  const appData = dataService.getAppData();
  const employee = useMemo(() => dataService.getEmployeeByToken(token), [token]);
  const monthData = dataService.getMonth(monthKey);

  if (!token) return <p>Укажите токен в URL: /me?token=...&month=01</p>;
  if (!employee) return <p>Сотрудник не найден или деактивирован.</p>;
  if (monthData.status !== 'published') return <p>График еще не опубликован</p>;

  return (
    <section>
      <h1>Мой график: {employee.full_name}</h1>
      <p>Месяц: {String(month).padStart(2, '0')}.2026</p>
      <ScheduleTable
        year={2026}
        month={month}
        employees={[employee]}
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
    </section>
  );
};
