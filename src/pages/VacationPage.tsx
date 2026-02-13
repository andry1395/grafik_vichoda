import { useMemo, useState } from 'react';
import { dataService } from '../services/dataService';
import { getSelectedAdminId } from '../utils/adminAuth';
import { MONTHS_2026 } from '../utils/constants';
import { countVacationDaysByLaborCode, validateVacationPartByLaborCode } from '../utils/vacation';

export const VacationPage = (): JSX.Element => {
  const selectedAdminId = getSelectedAdminId();
  const [employeeId, setEmployeeId] = useState('');
  const [month, setMonth] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notice, setNotice] = useState('');

  const monthKey = `2026-${String(month).padStart(2, '0')}`;
  const employees = useMemo(
    () => dataService.getEmployeesByAdmin(selectedAdminId).filter((employeeItem) => employeeItem.active),
    [selectedAdminId]
  );
  const employee = useMemo(() => employees.find((employeeItem) => employeeItem.id === employeeId) ?? null, [employeeId, employees]);
  const existingRequests = employee
    ? dataService
        .getVacationRequestsByAdmin(selectedAdminId)
        .filter((item) => item.employee_id === employee.id)
        .sort((left, right) => left.start_date.localeCompare(right.start_date))
    : [];
  const usedDays = employee
    ? existingRequests.map((item) => item.vacation_days)
    : [];
  const totalUsedDays = usedDays.reduce((sum, value) => sum + value, 0);
  const remainingDays = Math.max(0, 28 - totalUsedDays);

  const calculatedDays = startDate && endDate ? countVacationDaysByLaborCode(startDate, endDate) : 0;
  const endDateHoverTitle =
    startDate && endDate
      ? `Расчет отпуска: ${calculatedDays} дн. (праздничные дни не включаются)`
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
            Уже внесено: {request.start_date} — {request.end_date} ({request.vacation_days} дн.)
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
              setNotice(`Отпуск сохранен: ${calculatedDays} дн. (без праздничных дней по ст. 120 ТК РФ)`);
              setStartDate('');
              setEndDate('');
            }}
          >
            Сохранить отпуск
          </button>
        </div>
      )}

      {employee && remainingDays === 0 && <div className="notice">Лимит 28 дней уже полностью использован.</div>}

      {!!calculatedDays && <p>К расчету пойдет: {calculatedDays} дн. (праздничные дни не включаются, ст. 120 ТК РФ).</p>}
      {notice && <div className="notice">{notice}</div>}
    </section>
  );
};
