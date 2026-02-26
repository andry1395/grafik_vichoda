import { useMemo, useState } from 'react';
import { dataService } from '../services/dataService';
import { getSelectedAdminId } from '../utils/adminAuth';
import { MONTHS_2026 } from '../utils/constants';
import { formatDateDmy } from '../utils/date';
import { countVacationDaysByLaborCode, validateVacationPartByLaborCode } from '../utils/vacation';

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

export const VacationPage = (): JSX.Element => {
  const selectedAdminId = getSelectedAdminId();
  const [employeeId, setEmployeeId] = useState('');
  const [month, setMonth] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notice, setNotice] = useState('');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [tableEmployeeFilter, setTableEmployeeFilter] = useState<string>('all');

  const monthKey = `2026-${String(month).padStart(2, '0')}`;
  const employees = useMemo(
    () => dataService.getEmployeesByAdmin(selectedAdminId).filter((employeeItem) => employeeItem.active),
    [selectedAdminId]
  );
  const employee = useMemo(() => employees.find((employeeItem) => employeeItem.id === employeeId) ?? null, [employeeId, employees]);
  const employeeById = useMemo(() => new Map(employees.map((item) => [item.id, item.full_name])), [employees]);

  const allRequests = useMemo(
    () =>
      dataService
        .getVacationRequestsByAdmin(selectedAdminId)
        .map((request) => ({ ...request, employeeName: employeeById.get(request.employee_id) ?? 'Сотрудник удален' })),
    [employeeById, selectedAdminId]
  );

  const existingRequests = employee
    ? allRequests
        .filter((item) => item.employee_id === employee.id)
        .sort((left, right) => left.start_date.localeCompare(right.start_date))
    : [];

  const usedDays = employee ? existingRequests.map((item) => item.vacation_days) : [];
  const totalUsedDays = usedDays.reduce((sum, value) => sum + value, 0);
  const remainingDays = Math.max(0, 28 - totalUsedDays);

  const years = useMemo(() => {
    const uniqueYears = Array.from(new Set(allRequests.map((request) => getYearFromDate(request.start_date))));
    return uniqueYears.sort((left, right) => left - right);
  }, [allRequests]);

  const filteredRequests = useMemo(() => {
    return allRequests
      .filter((request) => {
        const requestYear = getYearFromDate(request.start_date);
        const requestMonth = getMonthFromMonthKey(request.month_key);
        const yearMatch = yearFilter === 'all' || requestYear === Number(yearFilter);
        const monthMatch = monthFilter === 'all' || requestMonth === Number(monthFilter);
        const employeeMatch = tableEmployeeFilter === 'all' || request.employee_id === tableEmployeeFilter;
        return yearMatch && monthMatch && employeeMatch;
      })
      .sort((left, right) => left.start_date.localeCompare(right.start_date));
  }, [allRequests, monthFilter, tableEmployeeFilter, yearFilter]);

  const overlapDetailsByRequestId = useMemo(() => {
    const details = new Map<string, string[]>();

    for (let i = 0; i < filteredRequests.length; i += 1) {
      for (let j = i + 1; j < filteredRequests.length; j += 1) {
        const left = filteredRequests[i];
        const right = filteredRequests[j];
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
  }, [filteredRequests]);

  const calculatedDays = startDate && endDate ? countVacationDaysByLaborCode(startDate, endDate) : 0;
  const endDateHoverTitle =
    startDate && endDate
      ? `Расчет отпуска: ${calculatedDays} дн.`
      : 'Выберите дату начала и окончания, чтобы увидеть расчет дней отпуска';

  return (
    <section>
      <h1>Заявка на отпуск</h1>
      <p>У сотрудника доступно 28 календарных дней отпуска в год, которые можно дробить. Уже сохранённые записи сотрудник не редактирует.</p>

      <div className="toolbar-row">
        <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
          <option value="">Выберите сотрудника</option>
          {employees.map((employeeItem) => (
            <option key={employeeItem.id} value={employeeItem.id}>
              {employeeItem.full_name}
            </option>
          ))}
        </select>
        <select value={month} onChange={(event) => setMonth(Number(event.target.value))}>
          {MONTHS_2026.map((value) => (
            <option key={value} value={value}>
              {String(value).padStart(2, '0')}.2026
            </option>
          ))}
        </select>
      </div>

      {!employee && employeeId && <div className="notice notice-error">Сотрудник не найден.</div>}
      {employee && <div className="notice">Сотрудник: {employee.full_name}</div>}
      {employee && (
        <div className="notice">
          Использовано: {totalUsedDays} дн. из 28 дн. Осталось: {remainingDays} дн.
        </div>
      )}

      {employee &&
        existingRequests.map((request) => (
          <div key={request.id} className="notice">
            Уже внесено: {formatDateDmy(request.start_date)} — {formatDateDmy(request.end_date)} ({request.vacation_days} дн.)
          </div>
        ))}

      {employee && remainingDays > 0 && (
        <div className="toolbar-row">
          <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            title={endDateHoverTitle}
            aria-label="Дата окончания отпуска. Наведите курсор для подсказки по количеству дней"
          />
          <button
            type="button"
            onClick={() => {
              if (!startDate || !endDate) {
                setNotice('Выберите даты начала и окончания.');
                return;
              }

              const validation = validateVacationPartByLaborCode(usedDays, calculatedDays);
              if (!validation.valid) {
                setNotice(validation.message ?? 'Ошибка валидации отпуска');
                return;
              }

              dataService.createVacationRequest({
                admin_id: selectedAdminId,
                employee_id: employee.id,
                month_key: monthKey,
                start_date: startDate,
                end_date: endDate,
                vacation_days: calculatedDays,
                created_by: 'employee'
              });
              setNotice(`Отпуск сохранен: ${calculatedDays} дн.`);
              setStartDate('');
              setEndDate('');
            }}
          >
            Сохранить отпуск
          </button>
        </div>
      )}

      {employee && remainingDays === 0 && <div className="notice">Лимит 28 дней уже полностью использован.</div>}

      <h2>Таблица отпусков всех сотрудников</h2>
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
        <select value={tableEmployeeFilter} onChange={(event) => setTableEmployeeFilter(event.target.value)}>
          <option value="all">Все сотрудники</option>
          {employees.map((employeeItem) => (
            <option key={employeeItem.id} value={employeeItem.id}>
              {employeeItem.full_name}
            </option>
          ))}
        </select>
      </div>

      <table className="simple-table">
        <thead>
          <tr>
            <th>Сотрудник</th>
            <th>Период</th>
            <th>Дней к оплате</th>
            <th>Пересечения</th>
          </tr>
        </thead>
        <tbody>
          {filteredRequests.map((request) => {
            const overlapDetails = overlapDetailsByRequestId.get(request.id) ?? [];
            const hasOverlap = overlapDetails.length > 0;
            return (
              <tr key={request.id} className={hasOverlap ? 'vacation-overlap-row' : undefined}>
                <td>{request.employeeName}</td>
                <td>
                  {formatDateDmy(request.start_date)} — {formatDateDmy(request.end_date)}
                </td>
                <td>{request.vacation_days}</td>
                <td>{hasOverlap ? overlapDetails.join(', ') : '—'}</td>
              </tr>
            );
          })}
          {filteredRequests.length === 0 && (
            <tr>
              <td colSpan={4}>По выбранным фильтрам отпусков нет.</td>
            </tr>
          )}
        </tbody>
      </table>

      {!!calculatedDays && <p>К расчету пойдет: {calculatedDays} дн.</p>}
      {notice && <div className="notice">{notice}</div>}
    </section>
  );
};
