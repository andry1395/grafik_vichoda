import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AdminMonthPage } from './pages/AdminMonthPage';
import { EmployeesPage } from './pages/EmployeesPage';
import { MePage } from './pages/MePage';
import { ObjectsPage } from './pages/ObjectsPage';

export const App = (): JSX.Element => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin/2026/01" replace />} />
      <Route element={<Layout />}>
        <Route path="/admin/2026/:month" element={<AdminMonthPage />} />
        <Route path="/admin/employees" element={<EmployeesPage />} />
        <Route path="/admin/objects" element={<ObjectsPage />} />
        <Route path="/me" element={<MePage />} />
      </Route>
    </Routes>
  );
};
