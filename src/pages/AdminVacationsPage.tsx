import { useMemo, useState } from 'react';
import { dataService } from '../services/dataService';
import { getSelectedAdminId } from '../utils/adminAuth';
import { countVacationDaysByLaborCode } from '../utils/vacation';
import { exportVacationsToCsv } from '../utils/export';
import { formatDateDmy } from '../utils/date';
import { MONTHS_2026 } from '../utils/constants';

const getYearFromDate = (isoDate: string): number => Number(isoDate.slice(0, 4));
const getMonthFromMonthKey = (monthKey: string): number => Number(monthKey.slice(5, 7));

const rangesOverlap = (leftStart: string, leftEnd: string, rightStart: string, rightEnd: string): boolean => {
  return leftStart <= rightEnd && rightStart <= leftEnd;
};

const countOverlapDays = (leftStart: string, leftEnd: string, rightStart: string, rightEnd: string): number => {
  const overlapStart = leftStart > rightStart ? leftStart : rightStart;
  const overlapEnd = leftEnd < rightEnd ? leftEnd : rightEnd;
  if (overlapStart > overlapEnd) return 0;
  return countVacationDaysByLaborCode(overlapStart, overlapEnd);
};

export const AdminVacationsPage = (): JSX.Element => {
  const selectedAdminId = getSelectedAdminId();
  const [notice, setNotice] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [tick, setTick] = useState(0);
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const employees = dataService.getEmployeesByAdmin(selectedAdminId);
  const requests = dataService.getVacationRequestsByAdmin(selectedAdminId);
  const employeeById = useMemo(() => new Map(employees.map((employee) => [employee.id, employee.full_name])), [employees]);

  const filteredRequests = requests.filter((request) => {
    if (!employeeFilter) return true;
    return request.employee_id === employeeFilter;
  });

  const overlapBaseRequests = useMemo(
    () =>
      requests
        .map((request) => ({ ...request, employeeName: employeeById.get(request.employee_id) ?? 'Сотрудник удален' }))
        .filter((request) => (employeeFilter ? request.employee_id === employeeFilter : true)),
    [employeeById, employeeFilter, requests]
  );

  const years = useMemo(() => {
    const uniqueYears = Array.from(new Set(overlapBaseRequests.map((request) => getYearFromDate(request.start_date))));
    return uniqueYears.sort((left, right) => left - right);
  }, [overlapBaseRequests]);

  const overlapTableRows = useMemo(() => {
    return overlapBaseRequests
      .filter((request) => {
        const requestYear = getYearFromDate(request.start_date);
        const requestMonth = getMonthFromMonthKey(request.month_key);
        const yearMatch = yearFilter === 'all' || requestYear === Number(yearFilter);
        const monthMatch = monthFilter === 'all' || requestMonth === Number(monthFilter);
        return yearMatch && monthMatch;
      })
      .sort((left, right) => {
        const cmp = left.start_date.localeCompare(right.start_date);
        return sortDirection === 'asc' ? cmp : -cmp;
      });
  }, [monthFilter, overlapBaseRequests, sortDirection, yearFilter]);

  const overlapDetailsByRequestId = useMemo(() => {
    const details = new Map<string, string[]>();

    for (let i = 0; i < overlapTableRows.length; i += 1) {
      for (let j = i + 1; j < overlapTableRows.length; j += 1) {
        const left = overlapTableRows[i];
        const right = overlapTableRows[j];
        if (left.employee_id === right.employee_id) continue;
        if (!rangesOverlap(left.start_date, left.end_date, right.start_date, right.end_date)) continue;

        const overlapDays = countOverlapDays(left.start_date, left.end_date, right.start_date, right.end_date);
        if (!overlapDays) continue;

        const leftText = `${right.employeeName} (${overlapDays} дн.)`;
        const rightText = `${left.employeeName} (${overlapDays} дн.)`;

        details.set(left.id, [...(details.get(left.id) ?? []), leftText]);
        details.set(right.id, [...(details.get(right.id) ?? []), rightText]);
      }
    }

    return new Map(Array.from(details.entries()).map(([id, items]) => [id, Array.from(new Set(items))]));
  }, [overlapTableRows]);

  const exportRows = filteredRequests.map((request) => ({
    employeeName: employeeById.get(request.employee_id) ?? 'Сотрудник удален',
    monthKey: request.month_key,
    startDate: request.start_date,
    endDate: request.end_date,
    vacationDays: request.vacation_days,
    source: request.created_by
  }));

  const editingVacationDays = startDate && endDate ? countVacationDaysByLaborCode(startDate, endDate) : 0;
  const endDateHoverTitle =
    startDate && endDate
      ? `Расчет отпуска: ${editingVacationDays} дн.`
      : 'Выберите дату начала и окончания, чтобы увидеть расчет дней отпуска';

  return (
    <section key={tick}>
      <h1>Отпуска сотрудников</h1>
      <p>Таблица формируется только по сотрудникам текущего администратора.</p>
      {notice && <div className="notice">{notice}</div>}

      <div className="toolbar-row">
        <select value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)}>
          <option value="">Все сотрудники</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.full_name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            exportVacationsToCsv(exportRows, selectedAdminId);
            setNotice('Таблица отпусков выгружена в CSV.');
          }}
        >
          Выгрузить таблицу отпусков (CSV)
        </button>
      </div>

      <table className="simple-table">
        <thead>
          <tr>
            <th>Сотрудник</th>
            <th>Месяц</th>
            <th>Период</th>
            <th>Дней к оплате</th>
            <th>Источник</th>
            <th>Действие</th>
          </tr>
        </thead>
        <tbody>
          {filteredRequests.map((request) => {
            const employee = employees.find((item) => item.id === request.employee_id);
            const isEditing = editingId === request.id;
            return (
              <tr key={request.id}>
                <td>{employee?.full_name ?? 'Сотрудник удален'}</td>
                <td>{request.month_key}</td>
                <td>
                  {isEditing ? (
                    <div className="toolbar-row">
                      <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                      <input
                        type="date"
                        value={endDate}
                        onChange={(event) => setEndDate(event.target.value)}
                        title={endDateHoverTitle}
                        aria-label="Дата окончания отпуска. Наведите курсор для подсказки по количеству дней"
                      />
                    </div>
                  ) : (
                    `${formatDateDmy(request.start_date)} — ${formatDateDmy(request.end_date)}`
                  )}
                </td>
                <td>{request.vacation_days}</td>
                <td>{request.created_by === 'employee' ? 'Сотрудник' : 'Админ'}</td>
                <td>
                  {isEditing ? (
                    <div className="toolbar-row">
                      <button
                        type="button"
                        onClick={() => {
                          const days = countVacationDaysByLaborCode(startDate, endDate);
                          if (!days) {
                            setNotice('Проверьте даты отпуска.');
                            return;
                          }
                          dataService.updateVacationRequest(request.id, {
                            start_date: startDate,
                            end_date: endDate,
                            vacation_days: days,
                            updatedBy: 'admin'
                          });
                          setEditingId(null);
                          setNotice('Данные отпуска обновлены администратором.');
                          setTick((value) => value + 1);
                        }}
                      >
                        Сохранить
                      </button>
                      <button type="button" onClick={() => setEditingId(null)}>
                        Отмена
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const removed = dataService.removeVacationRequest(request.id);
                          if (!removed) {
                            setNotice('Не удалось удалить отпуск: запись не найдена.');
                            return;
                          }
                          setEditingId(null);
                          setNotice('Отпуск удален администратором.');
                          setTick((value) => value + 1);
                        }}
                      >
                        Удалить отпуск
                      </button>
                    </div>
                  ) : (
                    <div className="toolbar-row">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(request.id);
                          setStartDate(request.start_date);
                          setEndDate(request.end_date);
                        }}
                      >
                        Редактировать (админ)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const removed = dataService.removeVacationRequest(request.id);
                          if (!removed) {
                            setNotice('Не удалось удалить отпуск: запись не найдена.');
                            return;
                          }
                          setNotice('Отпуск удален администратором.');
                          setTick((value) => value + 1);
                        }}
                      >
                        Удалить отпуск
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h2>Таблица пересечений отпусков</h2>
      <div className="toolbar-row">
        <select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}>
          <option value="all">Все годы</option>
          {years.map((year) => (
            <option key={year} value={String(year)}>
              {year}
            </option>
          ))}
        </select>
        <select value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)}>
          <option value="all">Все месяцы</option>
          {MONTHS_2026.map((value) => (
            <option key={value} value={String(value)}>
              {String(value).padStart(2, '0')}
            </option>
          ))}
        </select>
        <select value={sortDirection} onChange={(event) => setSortDirection(event.target.value as 'asc' | 'desc')}>
          <option value="asc">Сортировка: сначала ранние</option>
          <option value="desc">Сортировка: сначала поздние</option>
        </select>
      </div>

      <table className="simple-table">
        <thead>
          <tr>
            <th>Сотрудник</th>
            <th>Год</th>
            <th>Месяц</th>
            <th>Период</th>
            <th>Дней к оплате</th>
            <th>Пересечения</th>
          </tr>
        </thead>
        <tbody>
          {overlapTableRows.map((request) => {
            const year = getYearFromDate(request.start_date);
            const monthNumber = getMonthFromMonthKey(request.month_key);
            const overlapDetails = overlapDetailsByRequestId.get(request.id) ?? [];
            const hasOverlap = overlapDetails.length > 0;
            return (
              <tr key={request.id} className={hasOverlap ? 'vacation-overlap-row' : undefined}>
                <td>{request.employeeName}</td>
                <td>{year}</td>
                <td>{String(monthNumber).padStart(2, '0')}</td>
                <td>
                  {formatDateDmy(request.start_date)} — {formatDateDmy(request.end_date)}
                </td>
                <td>{request.vacation_days}</td>
                <td>{hasOverlap ? overlapDetails.join(', ') : '—'}</td>
              </tr>
            );
          })}
          {overlapTableRows.length === 0 && (
            <tr>
              <td colSpan={6}>По выбранным фильтрам отпусков нет.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
};
