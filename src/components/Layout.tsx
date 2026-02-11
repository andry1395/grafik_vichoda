import { Link, NavLink, Outlet } from 'react-router-dom';
import { MONTHS_2026 } from '../utils/constants';
import { setAdminSessionUnlocked } from '../utils/adminAuth';
import './Layout.css';

export const Layout = (): JSX.Element => {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/viewer" className="logo">
          График объектов 2026
        </Link>
        <button
          type="button"
          className="logout-btn"
          onClick={() => {
            setAdminSessionUnlocked(false);
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
          </div>
        </nav>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
};
