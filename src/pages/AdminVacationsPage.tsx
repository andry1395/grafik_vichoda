import { useMemo, useState } from 'react';
import { dataService } from '../services/dataService';
import { getSelectedAdminId } from '../utils/adminAuth';
import { countVacationDaysByLaborCode } from '../utils/vacation';
import { exportVacationsToCsv } from '../utils/export';
import { formatDateDmy } from '../utils/date';

export const AdminVacationsPage = (): JSX.Element => {
  const selectedAdminId = getSelectedAdminId();
  const [notice, setNotice] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [tick, setTick] = useState(0);
  const [employeeFilter, setEmployeeFilter] = useState('');

  const employees = dataService.getEmployeesByAdmin(selectedAdminId);
  const requests = dataService.getVacationRequestsByAdmin(selectedAdminId);
  const employeeById = useMemo(() => new Map(employees.map((employee) => [employee.id, employee.full_name])), [employees]);

  const filteredRequests = requests.filter((request) => {
    if (!employeeFilter) return true;
    return request.employee_id === employeeFilter;
  });

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
      ? `Расчет отпуска: ${editingVacationDays} дн. (праздничные дни не включаются)`
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
    </section>
  );
};
