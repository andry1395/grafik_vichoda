import { useState } from 'react';
import { dataService } from '../services/dataService';
import { getAdminSessionId, getSelectedAdminId } from '../utils/adminAuth';
import { MONTHS_2026 } from '../utils/constants';

const formatMonth = (month: number): string => `2026-${String(month).padStart(2, '0')}`;

const toNumber = (raw: string): number => {
  const normalized = raw.replace(',', '.').trim();
  const value = Number(normalized);
  return Number.isFinite(value) ? value : 0;
};

export const PlansPage = (): JSX.Element => {
  const selectedAdminId = getSelectedAdminId();
  const sessionAdminId = getAdminSessionId();
  const canEdit = sessionAdminId === selectedAdminId;
  const [notice, setNotice] = useState('');

  const rows = MONTHS_2026.map((month) => {
    const monthKey = formatMonth(month);
    return {
      month,
      monthKey,
      plan: dataService.getPlan(selectedAdminId, monthKey)
    };
  });

  return (
    <section>
      <h1>Планы</h1>
      <p>
        Плановые показатели по машинозаездам, среднему чеку и допродажам. Просмотр доступен всем, редактирование — только
        авторизованному администратору.
      </p>
      {notice && <div className="notice">{notice}</div>}
      {!canEdit && <div className="notice notice-error">Редактирование закрыто. Войдите как выбранный администратор.</div>}

      <div className="simple-table-container">
        <table className="simple-table plans-table">
          <thead>
            <tr>
              <th>Месяц</th>
              <th>Машинозаезды (план)</th>
              <th>Средний чек (₽)</th>
              <th>Воздушные фильтры (%)</th>
              <th>Салонные фильтры (%)</th>
              <th>Промывка (%)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ month, monthKey, plan }) => (
              <tr key={monthKey}>
                <td>{String(month).padStart(2, '0')}.2026</td>
                <td>
                  <input
                    type="number"
                    min={0}
                    disabled={!canEdit}
                    defaultValue={plan.cars_target}
                    onBlur={(event) => {
                      if (!canEdit) return;
                      dataService.setPlan(selectedAdminId, monthKey, { ...plan, cars_target: toNumber(event.target.value) });
                      setNotice('План обновлен');
                    }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    step="100"
                    disabled={!canEdit}
                    defaultValue={plan.avg_receipt_target}
                    onBlur={(event) => {
                      if (!canEdit) return;
                      dataService.setPlan(selectedAdminId, monthKey, { ...plan, avg_receipt_target: toNumber(event.target.value) });
                      setNotice('План обновлен');
                    }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    disabled={!canEdit}
                    defaultValue={plan.air_filter_ratio_target}
                    onBlur={(event) => {
                      if (!canEdit) return;
                      dataService.setPlan(selectedAdminId, monthKey, { ...plan, air_filter_ratio_target: toNumber(event.target.value) });
                      setNotice('План обновлен');
                    }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    disabled={!canEdit}
                    defaultValue={plan.cabin_filter_ratio_target}
                    onBlur={(event) => {
                      if (!canEdit) return;
                      dataService.setPlan(selectedAdminId, monthKey, { ...plan, cabin_filter_ratio_target: toNumber(event.target.value) });
                      setNotice('План обновлен');
                    }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    disabled={!canEdit}
                    defaultValue={plan.flush_ratio_target}
                    onBlur={(event) => {
                      if (!canEdit) return;
                      dataService.setPlan(selectedAdminId, monthKey, { ...plan, flush_ratio_target: toNumber(event.target.value) });
                      setNotice('План обновлен');
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
