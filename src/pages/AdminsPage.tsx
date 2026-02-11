import { useState } from 'react';
import { dataService } from '../services/dataService';

export const AdminsPage = (): JSX.Element => {
  const [tick, setTick] = useState(0);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const admins = dataService.getAdmins();

  return (
    <section>
      <h1>Управление администраторами (только главный администратор)</h1>
      <div className="toolbar-row">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Имя администратора" />
        <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Пароль" type="password" />
        <button
          type="button"
          onClick={() => {
            if (!name.trim() || !password.trim()) return;
            dataService.upsertAdmin({ name: name.trim(), password: password.trim(), is_super: false });
            setName('');
            setPassword('');
            setTick((value) => value + 1);
          }}
        >
          Добавить администратора
        </button>
      </div>

      <table className="simple-table" key={tick}>
        <thead>
          <tr>
            <th>Имя</th>
            <th>Роль</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {admins.map((admin) => (
            <AdminRow key={admin.id} adminId={admin.id} />
          ))}
        </tbody>
      </table>
    </section>
  );
};

const AdminRow = ({ adminId }: { adminId: string }): JSX.Element => {
  const admin = dataService.getAdmins().find((item) => item.id === adminId)!;
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(admin.name);
  const [editPassword, setEditPassword] = useState('');

  if (admin.is_super) {
    return (
      <tr>
        <td>{admin.name}</td>
        <td>Главный администратор</td>
        <td>—</td>
      </tr>
    );
  }

  return (
    <tr>
      <td>{isEditing ? <input value={editName} onChange={(event) => setEditName(event.target.value)} /> : admin.name}</td>
      <td>Администратор</td>
      <td>
        <div className="toolbar-row">
          {isEditing ? (
            <>
              <input
                value={editPassword}
                onChange={(event) => setEditPassword(event.target.value)}
                placeholder="Новый пароль (необязательно)"
                type="password"
              />
              <button
                type="button"
                onClick={() => {
                  if (!editName.trim()) return;
                  dataService.upsertAdmin({
                    id: admin.id,
                    name: editName.trim(),
                    password: editPassword.trim() || admin.password,
                    is_super: false
                  });
                  setIsEditing(false);
                  setEditPassword('');
                  window.location.reload();
                }}
              >
                Сохранить
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setEditName(admin.name);
                  setEditPassword('');
                }}
              >
                Отмена
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setIsEditing(true)}>
              Редактировать
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (!window.confirm(`Удалить администратора ${admin.name}?`)) return;
              dataService.removeAdmin(admin.id);
              window.location.reload();
            }}
          >
            Удалить
          </button>
        </div>
      </td>
    </tr>
  );
};
