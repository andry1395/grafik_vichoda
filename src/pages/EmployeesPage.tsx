import { useState } from 'react';
import { dataService } from '../services/dataService';

export const EmployeesPage = (): JSX.Element => {
  const [tick, setTick] = useState(0);
  const [fullName, setFullName] = useState('');
  const [notice, setNotice] = useState('');

  const employees = dataService.getAppData().employees;

  return (
    <section>
      <h1>Сотрудники</h1>
      {notice && <div className="notice">{notice}</div>}
      <div className="toolbar-row">
        <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Фамилия Имя" />
        <button
          type="button"
          onClick={() => {
            if (!fullName.trim()) return;
            dataService.upsertEmployee({ full_name: fullName.trim(), active: true });
            setFullName('');
            setTick((value) => value + 1);
            setNotice('Сохранено');
          }}
        >
          Добавить
        </button>
      </div>
      <table className="simple-table" key={tick}>
        <thead>
          <tr>
            <th>ФИО</th>
            <th>Токен</th>
            <th>Активность</th>
            <th>Действие</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => (
            <tr key={employee.id}>
              <td>{employee.full_name}</td>
              <td>{employee.token}</td>
              <td>{employee.active ? 'Активен' : 'Неактивен'}</td>
              <td>
                <button
                  type="button"
                  onClick={() => {
                    dataService.upsertEmployee({
                      id: employee.id,
                      full_name: employee.full_name,
                      active: !employee.active,
                      token: employee.token
                    });
                    setTick((value) => value + 1);
                    setNotice('Сохранено');
                  }}
                >
                  {employee.active ? 'Деактивировать' : 'Активировать'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
};
