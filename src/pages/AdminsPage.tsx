import { useState } from 'react';
import { dataService } from '../services/dataService';

export const AdminsPage = (): JSX.Element => {
  const [tick, setTick] = useState(0);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');

  const admins = dataService.getAdmins();

  return (
    <section>
      <h1>Управление администраторами (только главный админ)</h1>
      <div className="toolbar-row">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Имя админа" />
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
          Добавить админа
        </button>
      </div>

      <table className="simple-table" key={tick}>
        <thead>
          <tr>
            <th>Имя</th>
            <th>Роль</th>
            <th>Новый пароль</th>
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
  const [newPassword, setNewPassword] = useState('');

  return (
    <tr>
      <td>{admin.name}</td>
      <td>{admin.is_super ? 'Главный админ' : 'Админ'}</td>
      <td>
        {admin.is_super ? (
          '—'
        ) : (
          <input value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Новый пароль" type="password" />
        )}
      </td>
      <td>
        <div className="toolbar-row">
          {!admin.is_super && (
            <>
              <button
                type="button"
                onClick={() => {
                  if (!newPassword.trim()) return;
                  dataService.upsertAdmin({ id: admin.id, name: admin.name, password: newPassword.trim(), is_super: false });
                  setNewPassword('');
                  window.location.reload();
                }}
              >
                Сменить пароль
              </button>
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
            </>
          )}
        </div>
      </td>
    </tr>
  );
};
