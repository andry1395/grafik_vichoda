import { Link, NavLink, Outlet } from 'react-router-dom';
import { MONTHS_2026 } from '../utils/constants';
import { clearAdminSession, getSelectedAdminId, setSelectedAdminId } from '../utils/adminAuth';
import { dataService } from '../services/dataService';
import './Layout.css';

export const Layout = (): JSX.Element => {
  const admins = dataService.getAdmins();
  const selectedAdminId = getSelectedAdminId();

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/viewer" className="logo">
          График объектов 2026
        </Link>

        <div className="admin-tabs">
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
          Выйти из админ-режима
        </button>
      </header>
      <aside className="sidebar">
        <h3>Сотрудники</h3>
        <nav>
          <div className="nav-group">
            <NavLink to="/viewer">Просмотр графиков</NavLink>
          </div>

          <h3>Админка</h3>
          <div className="nav-group">
            <span>Месяцы</span>
            {MONTHS_2026.map((month) => (
              <NavLink key={month} to={`/admin/2026/${String(month).padStart(2, '0')}`}>
                {String(month).padStart(2, '0')}.2026
              </NavLink>
            ))}
          </div>
          <div className="nav-group">
            <NavLink to="/admin/employees">Сотрудники</NavLink>
            <NavLink to="/admin/objects">Объекты</NavLink>
            <NavLink to="/admin/admins">Админы</NavLink>
          </div>
        </nav>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
};
