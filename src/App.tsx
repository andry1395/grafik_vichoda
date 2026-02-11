import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AdminMonthPage } from './pages/AdminMonthPage';
import { EmployeesPage } from './pages/EmployeesPage';
import { MePage } from './pages/MePage';
import { ObjectsPage } from './pages/ObjectsPage';
import { ADMIN_PASSWORD, isAdminSessionUnlocked, setAdminSessionUnlocked } from './utils/adminAuth';
import { useMemo, useState } from 'react';

const AdminGate = ({ children }: { children: JSX.Element }): JSX.Element => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [unlocked, setUnlocked] = useState(isAdminSessionUnlocked());

  const gate = useMemo(
    () => (
      <section>
        <h1>Админка: вход</h1>
        <p>Редактировать график может только администратор. Введите пароль.</p>
        <div className="toolbar-row">
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Пароль администратора"
          />
          <button
            type="button"
            onClick={() => {
              if (password === ADMIN_PASSWORD) {
                setAdminSessionUnlocked(true);
                setUnlocked(true);
                setError('');
              } else {
                setError('Неверный пароль');
              }
            }}
          >
            Войти
          </button>
        </div>
        {error && <div className="notice notice-error">{error}</div>}
      </section>
    ),
    [password, error]
  );

  return unlocked ? children : gate;
};

export const App = (): JSX.Element => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/viewer" replace />} />
      <Route element={<Layout />}>
        <Route path="/viewer" element={<MePage />} />
        <Route path="/me" element={<Navigate to="/viewer" replace />} />

        <Route
          path="/admin/2026/:month"
          element={
            <AdminGate>
              <AdminMonthPage />
            </AdminGate>
          }
        />
        <Route
          path="/admin/employees"
          element={
            <AdminGate>
              <EmployeesPage />
            </AdminGate>
          }
        />
        <Route
          path="/admin/objects"
          element={
            <AdminGate>
              <ObjectsPage />
            </AdminGate>
          }
        />
      </Route>
    </Routes>
  );
};
