import { useRef, useState } from 'react';
import { dataService } from '../services/dataService';
import type { EmployeeRole } from '../types';
import { getSelectedAdminId } from '../utils/adminAuth';

export const EmployeesPage = (): JSX.Element => {
  const selectedAdminId = getSelectedAdminId();
  const [tick, setTick] = useState(0);
  const [fullName, setFullName] = useState('');
  const [newRole, setNewRole] = useState<EmployeeRole>('mechanic');
  const [newPrimaryObjectId, setNewPrimaryObjectId] = useState('');
  const [notice, setNotice] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingRole, setEditingRole] = useState<EmployeeRole>('mechanic');
  const [editingPrimaryObjectId, setEditingPrimaryObjectId] = useState('');
  const [draggedEmployeeId, setDraggedEmployeeId] = useState<string | null>(null);
  const draggedEmployeeIdRef = useRef<string | null>(null);

  const employees = dataService.getEmployeesByAdmin(selectedAdminId);
  const objects = dataService.getObjectsByAdmin(selectedAdminId).filter((item) => item.active);

  const finishDrag = (): void => {
    draggedEmployeeIdRef.current = null;
    setDraggedEmployeeId(null);
  };

  const reorderEmployee = (targetEmployeeId: string): void => {
    const sourceEmployeeId = draggedEmployeeIdRef.current ?? draggedEmployeeId;
    if (!sourceEmployeeId || sourceEmployeeId === targetEmployeeId) return;

    const orderedIds = employees.map((item) => item.id);
    const fromIndex = orderedIds.indexOf(sourceEmployeeId);
    const toIndex = orderedIds.indexOf(targetEmployeeId);
    if (fromIndex < 0 || toIndex < 0) return;

    orderedIds.splice(fromIndex, 1);
    orderedIds.splice(toIndex, 0, sourceEmployeeId);
    dataService.reorderEmployeesByAdmin(selectedAdminId, orderedIds);
    setTick((value) => value + 1);
    setNotice('Порядок сотрудников обновлен');
    finishDrag();
  };

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
        <select value={newPrimaryObjectId} onChange={(event) => setNewPrimaryObjectId(event.target.value)}>
          <option value="">Главный объект (выберите)</option>
          {objects.map((objectItem) => (
            <option key={objectItem.id} value={objectItem.id}>
              {objectItem.short_ru || objectItem.name_ru}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            if (!fullName.trim()) return;
            if (!newPrimaryObjectId) {
              setNotice('Выберите главный объект для сотрудника.');
              return;
            }
            dataService.upsertEmployee({
              admin_id: selectedAdminId,
              full_name: fullName.trim(),
              active: true,
              role: newRole,
              primary_object_id: newPrimaryObjectId
            });
            setFullName('');
            setNewRole('mechanic');
            setNewPrimaryObjectId('');
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
            <th>Главный объект</th>
            <th>Токен</th>
            <th>Активность</th>
            <th>Действие</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => {
            const isEditing = editingId === employee.id;
            return (
              <tr
                key={employee.id}
                onDragOver={(event) => {
                  if (!editingId && draggedEmployeeIdRef.current) event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (isEditing) return;
                  reorderEmployee(employee.id);
                }}
              >
                <td
                  draggable={!isEditing}
                  onDragStart={(event) => {
                    draggedEmployeeIdRef.current = employee.id;
                    setDraggedEmployeeId(employee.id);
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', employee.id);
                  }}
                  onDragEnd={finishDrag}
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
                <td>
                  {isEditing ? (
                    <select value={editingPrimaryObjectId} onChange={(event) => setEditingPrimaryObjectId(event.target.value)}>
                      <option value="">Главный объект (выберите)</option>
                      {objects.map((objectItem) => (
                        <option key={objectItem.id} value={objectItem.id}>
                          {objectItem.short_ru || objectItem.name_ru}
                        </option>
                      ))}
                    </select>
                  ) : (
                    objects.find((item) => item.id === employee.primary_object_id)?.short_ru ||
                    objects.find((item) => item.id === employee.primary_object_id)?.name_ru ||
                    '—'
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
                            if (!editingPrimaryObjectId) {
                              setNotice('Выберите главный объект для сотрудника.');
                              return;
                            }
                            dataService.upsertEmployee({
                              id: employee.id,
                              admin_id: selectedAdminId,
                              full_name: editingName.trim(),
                              active: employee.active,
                              token: employee.token,
                              role: editingRole,
                              primary_object_id: editingPrimaryObjectId
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
                          setEditingPrimaryObjectId(employee.primary_object_id ?? '');
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
                          role: employee.role,
                          primary_object_id: employee.primary_object_id ?? null
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
