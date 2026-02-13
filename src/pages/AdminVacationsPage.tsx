import { useState } from 'react';
import { dataService } from '../services/dataService';
import { getSelectedAdminId } from '../utils/adminAuth';
import { countVacationDaysByLaborCode } from '../utils/vacation';

export const AdminVacationsPage = (): JSX.Element => {
  const selectedAdminId = getSelectedAdminId();
  const [notice, setNotice] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [tick, setTick] = useState(0);

  const employees = dataService.getEmployeesByAdmin(selectedAdminId);
  const requests = dataService.getVacationRequestsByAdmin(selectedAdminId);

  return (
    <section key={tick}>
      <h1>Отпуска сотрудников</h1>
      <p>Таблица формируется только по сотрудникам текущего администратора.</p>
      {notice && <div className="notice">{notice}</div>}

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
          {requests.map((request) => {
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
                      <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                    </div>
                  ) : (
                    `${request.start_date} — ${request.end_date}`
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
                    </div>
                  ) : (
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
