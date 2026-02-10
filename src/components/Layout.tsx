import { Link, NavLink, Outlet } from 'react-router-dom';
import { MONTHS_2026 } from '../utils/constants';
import './Layout.css';

export const Layout = (): JSX.Element => {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/admin/2026/01" className="logo">
          График объектов 2026
        </Link>
      </header>
      <aside className="sidebar">
        <h3>Админ</h3>
        <nav>
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
            <NavLink to="/me">Режим сотрудника</NavLink>
          </div>
        </nav>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
};
