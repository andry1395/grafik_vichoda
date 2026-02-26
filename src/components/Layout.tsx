import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { MONTHS_2026 } from '../utils/constants';
import { clearAdminSession, getSelectedAdminId, setSelectedAdminId } from '../utils/adminAuth';
import { dataService } from '../services/dataService';
import './Layout.css';

export const Layout = (): JSX.Element => {
  const admins = dataService.getAdmins();
  const selectedAdminId = getSelectedAdminId();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const syncState = dataService.getSyncState();

  const syncLabel = useMemo(() => {
    if (!syncState.configured) return '⚠️ Firebase не настроен (работа только локально)';
    if (syncState.lastError) return `⚠️ Ошибка синхронизации: ${syncState.lastError}`;
    if (syncState.pendingPush) return '⏳ Изменения отправляются в БД...';
    if (syncState.lastPushAt) return `✅ Синхронизировано: ${new Date(syncState.lastPushAt).toLocaleTimeString('ru-RU')}`;
    return '⏳ Ожидание первой синхронизации';
  }, [syncState.configured, syncState.lastError, syncState.pendingPush, syncState.lastPushAt]);

  useEffect(() => {
    if (window.matchMedia('(max-width: 900px)').matches) {
      setSidebarOpen(false);
    }
  }, []);

  const closeSidebarOnMobile = (): void => {
    if (window.matchMedia('(max-width: 900px)').matches) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className={`app-shell ${sidebarOpen ? 'sidebar-open' : 'sidebar-hidden'}`}>
      <header className="topbar">
        <button
          type="button"
          className="menu-toggle"
          onClick={() => setSidebarOpen((value) => !value)}
          aria-label={sidebarOpen ? 'Скрыть боковую панель' : 'Показать боковую панель'}
          aria-expanded={sidebarOpen}
        >
          {sidebarOpen ? '☰ Скрыть меню' : '☰ Показать меню'}
        </button>

        <Link to="/viewer" className="logo">
          График объектов 2026
        </Link>

        <div className="topbar-actions">
          <span style={{ fontSize: '0.85rem', maxWidth: 360 }}>{syncLabel}</span>
          <label className="sr-only" htmlFor="admin-select">
            Выбор администратора
          </label>
          <select
            id="admin-select"
            className="admin-select"
            value={selectedAdminId}
            onChange={(event) => {
              setSelectedAdminId(event.target.value);
              clearAdminSession();
              window.location.reload();
            }}
          >
            {admins.map((admin) => (
              <option key={admin.id} value={admin.id}>
                {admin.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="logout-btn"
            onClick={() => {
              clearAdminSession();
              window.location.hash = '#/admin/2026/01';
            }}
          >
            Выйти
          </button>
        </div>
      </header>

      {sidebarOpen && <button type="button" className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-label="Закрыть меню" />}

      <aside className="sidebar">
        <h3>Сотрудники</h3>
        <nav>
          <div className="nav-group">
            <NavLink to="/viewer" onClick={closeSidebarOnMobile}>
              Просмотр графиков
            </NavLink>
            <NavLink to="/vacation" onClick={closeSidebarOnMobile}>
              Мой отпуск
            </NavLink>
            <NavLink to="/plans" onClick={closeSidebarOnMobile}>
              Планы
            </NavLink>
          </div>

          <h3>Администрирование</h3>
          <div className="nav-group">
            <span>Месяцы</span>
            {MONTHS_2026.map((month) => (
              <NavLink key={month} to={`/admin/2026/${String(month).padStart(2, '0')}`} onClick={closeSidebarOnMobile}>
                {String(month).padStart(2, '0')}.2026
              </NavLink>
            ))}
          </div>
          <div className="nav-group">
            <NavLink to="/admin/employees" onClick={closeSidebarOnMobile}>
              Сотрудники
            </NavLink>
            <NavLink to="/admin/objects" onClick={closeSidebarOnMobile}>
              Объекты
            </NavLink>
            <NavLink to="/admin/vacations" onClick={closeSidebarOnMobile}>
              Отпуска
            </NavLink>
            <NavLink to="/admin/admins" onClick={closeSidebarOnMobile}>
              Админы
            </NavLink>
            <NavLink to="/admin/sync" onClick={closeSidebarOnMobile}>
              Диагностика Firebase
            </NavLink>
          </div>
        </nav>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
};
