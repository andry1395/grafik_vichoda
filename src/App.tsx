import { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AdminMonthPage } from './pages/AdminMonthPage';
import { AdminsPage } from './pages/AdminsPage';
import { EmployeesPage } from './pages/EmployeesPage';
import { MePage } from './pages/MePage';
import { ObjectsPage } from './pages/ObjectsPage';
import { SyncDebugPage } from './pages/SyncDebugPage';
import { VacationPage } from './pages/VacationPage';
import { AdminVacationsPage } from './pages/AdminVacationsPage';
import { PlansPage } from './pages/PlansPage';
import { dataService } from './services/dataService';
import { getAdminSessionId, getSelectedAdminId, setAdminSessionId } from './utils/adminAuth';
import { featureFlags } from './utils/featureFlags';

const AdminGate = ({ children, superOnly = false }: { children: JSX.Element; superOnly?: boolean }): JSX.Element => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  const selectedAdminId = getSelectedAdminId();
  const selectedAdmin = dataService.getAdmins().find((item) => item.id === selectedAdminId);
  const sessionAdminId = getAdminSessionId();
  const unlocked = sessionAdminId === selectedAdminId;
  const isSuper = Boolean(selectedAdmin?.is_super);

  if (!selectedAdmin) {
    return <p>Админ не найден. Выберите вкладку администратора.</p>;
  }

  if (superOnly && !isSuper) {
    return <p>Доступно только главному админу.</p>;
  }

  const gate = useMemo(
    () => (
      <section key={tick}>
        <h1>Администрирование: вход ({selectedAdmin.name})</h1>
        <p>Редактировать график может только выбранный администратор. Введите пароль.</p>
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
              if (dataService.validateAdminPassword(selectedAdminId, password)) {
                setAdminSessionId(selectedAdminId);
                setError('');
                setTick((value) => value + 1);
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
    [error, password, selectedAdmin.name, selectedAdminId, tick]
  );

  return unlocked ? children : gate;
};

export const App = (): JSX.Element => {
  const [, setTick] = useState(0);

  useEffect(() => {
    return dataService.subscribeToChanges(() => {
      setTick((value) => value + 1);
    });
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/viewer" replace />} />
      <Route element={<Layout />}>
        <Route path="/viewer" element={<MePage />} />
        <Route path="/vacation" element={<VacationPage />} />
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
        <Route
          path="/admin/vacations"
          element={
            <AdminGate>
              <AdminVacationsPage />
            </AdminGate>
          }
        />
        <Route
          path="/admin/sync"
          element={
            <AdminGate>
              <SyncDebugPage />
            </AdminGate>
          }
        />
        {featureFlags.plansPage && (
          <Route
            path="/admin/plans"
            element={
              <AdminGate superOnly>
                <PlansPage />
              </AdminGate>
            }
          />
        )}


        <Route
          path="/admin/admins"
          element={
            <AdminGate superOnly>
              <AdminsPage />
            </AdminGate>
          }
        />
      </Route>
    </Routes>
  );
};
