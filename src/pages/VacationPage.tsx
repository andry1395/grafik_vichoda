import { useMemo, useState } from 'react';
import { dataService } from '../services/dataService';
import { getSelectedAdminId } from '../utils/adminAuth';
import { MONTHS_2026 } from '../utils/constants';
import { countVacationDaysByLaborCode, validateVacationPartByLaborCode } from '../utils/vacation';

export const VacationPage = (): JSX.Element => {
  const selectedAdminId = getSelectedAdminId();
  const [token, setToken] = useState('');
  const [month, setMonth] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notice, setNotice] = useState('');

  const monthKey = `2026-${String(month).padStart(2, '0')}`;
  const employee = useMemo(() => dataService.getEmployeeByToken(selectedAdminId, token), [selectedAdminId, token]);
  const existingRequest = employee ? dataService.getVacationRequestByEmployeeAndMonth(selectedAdminId, employee.id, monthKey) : null;
  const usedDays = employee
    ? dataService
        .getVacationRequestsByAdmin(selectedAdminId)
        .filter((item) => item.employee_id === employee.id)
        .map((item) => item.vacation_days)
    : [];

  const calculatedDays = startDate && endDate ? countVacationDaysByLaborCode(startDate, endDate) : 0;

  return (
    <section>
      <h1>Заявка на отпуск</h1>
      <p>Сотрудник вносит отпуск один раз. Изменить даты после сохранения нельзя — корректировку выполняет только администратор.</p>

      <div className="toolbar-row">
        <input value={token} onChange={(event) => setToken(event.target.value)} placeholder="Токен сотрудника" />
        <select value={month} onChange={(event) => setMonth(Number(event.target.value))}>
          {MONTHS_2026.map((value) => (
            <option key={value} value={value}>
              {String(value).padStart(2, '0')}.2026
            </option>
          ))}
        </select>
      </div>

      {!employee && token.trim() && <div className="notice notice-error">Сотрудник не найден. Проверьте токен.</div>}
      {employee && <div className="notice">Сотрудник: {employee.full_name}</div>}

      {employee && existingRequest && (
        <div className="notice">
          Отпуск уже внесен: {existingRequest.start_date} — {existingRequest.end_date} ({existingRequest.vacation_days} дн.).
        </div>
      )}

      {employee && !existingRequest && (
        <div className="toolbar-row">
          <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
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
            }}
          >
            Сохранить отпуск
          </button>
        </div>
      )}

      {!!calculatedDays && <p>К расчету пойдет: {calculatedDays} дн. (праздничные дни не включаются, ст. 120 ТК РФ).</p>}
      {notice && <div className="notice">{notice}</div>}
    </section>
  );
};
