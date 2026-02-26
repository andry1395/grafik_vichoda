import { useState } from 'react';
import { dataService } from '../services/dataService';
import type { EmployeeRole } from '../types';
import { getSelectedAdminId } from '../utils/adminAuth';

export const EmployeesPage = (): JSX.Element => {
  const selectedAdminId = getSelectedAdminId();
  const [tick, setTick] = useState(0);
  const [fullName, setFullName] = useState('');
  const [newRole, setNewRole] = useState<EmployeeRole>('mechanic');
  const [notice, setNotice] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingRole, setEditingRole] = useState<EmployeeRole>('mechanic');
  const [draggedEmployeeId, setDraggedEmployeeId] = useState<string | null>(null);

  const employees = dataService.getEmployeesByAdmin(selectedAdminId);

  return (
    <section>
      <h1>Сотрудники</h1>
      {notice && <div className="notice">{notice}</div>}
      <div className="toolbar-row">
        <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Фамилия Имя" />
        <select value={newRole} onChange={(event) => setNewRole(event.target.value as EmployeeRole)}>
          <option value="mechanic">Механик</option>
          <option value="trainee">Стажер</option>
        </select>
        <button
          type="button"
          onClick={() => {
            if (!fullName.trim()) return;
            dataService.upsertEmployee({ admin_id: selectedAdminId, full_name: fullName.trim(), active: true, role: newRole });
            setFullName('');
            setNewRole('mechanic');
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
            <th>↕</th>
            <th>ФИО</th>
            <th>Роль</th>
            <th>Токен</th>
            <th>Активность</th>
            <th>Действие</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => {
            const isEditing = editingId === employee.id;
            return (
              <tr key={employee.id}>
                <td
                  draggable={!isEditing}
                  onDragStart={() => setDraggedEmployeeId(employee.id)}
                  onDragOver={(event) => {
                    event.preventDefault();
                  }}
                  onDrop={() => {
                    if (!draggedEmployeeId || draggedEmployeeId === employee.id) return;
                    const orderedIds = employees.map((item) => item.id);
                    const fromIndex = orderedIds.indexOf(draggedEmployeeId);
                    const toIndex = orderedIds.indexOf(employee.id);
                    if (fromIndex < 0 || toIndex < 0) return;
                    orderedIds.splice(fromIndex, 1);
                    orderedIds.splice(toIndex, 0, draggedEmployeeId);
                    dataService.reorderEmployeesByAdmin(selectedAdminId, orderedIds);
                    setTick((value) => value + 1);
                    setNotice('Порядок сотрудников обновлен');
                    setDraggedEmployeeId(null);
                  }}
                  onDragEnd={() => setDraggedEmployeeId(null)}
                  title="Перетащите, чтобы изменить порядок"
                >
                  ⇅
                </td>
                <td>{isEditing ? <input value={editingName} onChange={(event) => setEditingName(event.target.value)} /> : employee.full_name}</td>
                <td>
                  {isEditing ? (
                    <select value={editingRole} onChange={(event) => setEditingRole(event.target.value as EmployeeRole)}>
                      <option value="mechanic">Механик</option>
                      <option value="trainee">Стажер</option>
                    </select>
                  ) : employee.role === 'trainee' ? (
                    'Стажер'
                  ) : (
                    'Механик'
                  )}
                </td>
                <td>{employee.token}</td>
                <td>{employee.active ? 'Активен' : 'Неактивен'}</td>
                <td>
                  <div className="toolbar-row">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            if (!editingName.trim()) return;
                            dataService.upsertEmployee({
                              id: employee.id,
                              admin_id: selectedAdminId,
                              full_name: editingName.trim(),
                              active: employee.active,
                              token: employee.token,
                              role: editingRole
                            });
                            setEditingId(null);
                            setTick((value) => value + 1);
                            setNotice('Сохранено');
                          }}
                        >
                          Сохранить
                        </button>
                        <button type="button" onClick={() => setEditingId(null)}>
                          Отмена
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(employee.id);
                          setEditingName(employee.full_name);
                          setEditingRole(employee.role ?? 'mechanic');
                        }}
                      >
                        Редактировать
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        dataService.upsertEmployee({
                          id: employee.id,
                          admin_id: selectedAdminId,
                          full_name: employee.full_name,
                          active: !employee.active,
                          token: employee.token,
                          role: employee.role
                        });
                        if (editingId === employee.id) setEditingId(null);
                        setTick((value) => value + 1);
                        setNotice('Сохранено');
                      }}
                    >
                      {employee.active ? 'Деактивировать' : 'Активировать'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (!window.confirm(`Удалить сотрудника ${employee.full_name}?`)) return;
                        dataService.removeEmployee(employee.id);
                        if (editingId === employee.id) setEditingId(null);
                        setTick((value) => value + 1);
                        setNotice('Сотрудник удален');
                      }}
                    >
                      Удалить
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
};
