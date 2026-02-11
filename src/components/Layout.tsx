import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { MONTHS_2026 } from '../utils/constants';
import { clearAdminSession, getSelectedAdminId, setSelectedAdminId } from '../utils/adminAuth';
import { dataService } from '../services/dataService';
import './Layout.css';

export const Layout = (): JSX.Element => {
  const admins = dataService.getAdmins();
  const selectedAdminId = getSelectedAdminId();
  const [sidebarOpen, setSidebarOpen] = useState(true);


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
          <div className="admin-tabs" aria-label="Переключение администраторов">
            {admins.map((admin) => (
              <button
                key={admin.id}
                type="button"
                className={selectedAdminId === admin.id ? 'admin-tab active' : 'admin-tab'}
                onClick={() => {
                  setSelectedAdminId(admin.id);
                  clearAdminSession();
                  window.location.reload();
                }}
              >
                {admin.name}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="logout-btn"
            onClick={() => {
              clearAdminSession();
              window.location.hash = '#/admin/2026/01';
            }}
          >
            Выйти из администрирования
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
            <NavLink to="/admin/admins" onClick={closeSidebarOnMobile}>
              Админы
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
