import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ScheduleTable } from '../components/ScheduleTable';
import { dataService } from '../services/dataService';
import type { SpecialValue } from '../types';
import { buildDateKey, daysInMonth } from '../utils/date';
import { exportMonthToXlsx } from '../utils/export';

export const AdminMonthPage = (): JSX.Element => {
  const params = useParams<{ month: string }>();
  const month = Number(params.month ?? '1');
  const monthKey = `2026-${String(month).padStart(2, '0')}`;
  const [tick, setTick] = useState(0);
  const [notice, setNotice] = useState<string>('');
  const [employeeSearch, setEmployeeSearch] = useState('');

  const appData = dataService.getAppData();
  const activeEmployees = appData.employees.filter((employee) => employee.active);
  const employees = activeEmployees.filter((employee) =>
    employee.full_name.toLocaleLowerCase('ru-RU').includes(employeeSearch.trim().toLocaleLowerCase('ru-RU'))
  );
  const objects = appData.objects;
  const monthData = dataService.getMonth(monthKey);

  const dates = useMemo(() => {
    const count = daysInMonth(2026, month);
    return Array.from({ length: count }, (_, idx) => buildDateKey(2026, month, idx + 1));
  }, [month, tick]);

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

      <div className="toolbar-row">
        <input
          value={employeeSearch}
          onChange={(event) => setEmployeeSearch(event.target.value)}
          placeholder="Поиск сотрудника по имени"
        />
        <button type="button" onClick={() => rerender('Сохранено')}>
          Сохранить
        </button>
        <button
          type="button"
          onClick={() => {
            dataService.publishMonth(
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
            dataService.setMonthStatus(monthKey, 'draft');
            rerender('Публикация снята');
          }}
        >
          Снять публикацию
        </button>
        <button
          type="button"
          onClick={() => {
            exportMonthToXlsx({
              year: 2026,
              month,
              employees,
              objects,
              getCellValue: (employeeId, date) => dataService.getCellValue(monthKey, employeeId, date)
            });
          }}
        >
          Выгрузить XLSX
        </button>
      </div>

      <ScheduleTable
        year={2026}
        month={month}
        employees={employees}
        objects={objects}
        getCellValue={(employeeId, date) => dataService.getCellValue(monthKey, employeeId, date)}
        setCellValue={(employeeId, date, value) => {
          if (value.type === 'OBJECT') {
            dataService.setEntry(monthKey, employeeId, date, { kind: 'OBJECT', object_id: value.value });
          } else {
            dataService.setEntry(monthKey, employeeId, date, { kind: 'SPECIAL', special: value.value as SpecialValue });
          }
          setTick((x) => x + 1);
        }}
        clearCellValue={(employeeId, date) => {
          dataService.clearEntry(monthKey, employeeId, date);
          setTick((x) => x + 1);
        }}
      />
    </section>
  );
};
