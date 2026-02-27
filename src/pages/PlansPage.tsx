import { useEffect, useState } from 'react';
import { dataService } from '../services/dataService';
import { getAdminSessionId } from '../utils/adminAuth';

const PLAN_MONTHS = Array.from({ length: 12 }, (_, index) => `2026-${String(index + 1).padStart(2, '0')}`);


const toPlanPayload = (metrics: ReturnType<typeof dataService.getPlanMetrics>) => ({
  car_entries_plan: metrics.car_entries_plan,
  average_check_plan: metrics.average_check_plan,
  air_filter_ratio_plan: metrics.air_filter_ratio_plan,
  cabin_filter_ratio_plan: metrics.cabin_filter_ratio_plan,
  flush_usage_ratio_plan: metrics.flush_usage_ratio_plan
});

export const PlansPage = (): JSX.Element => {
  const admins = dataService.getAdmins();
  const [selectedAdminId, setSelectedAdminId] = useState(admins[0]?.id ?? dataService.SUPER_ADMIN_ID);
  const sessionAdminId = getAdminSessionId();

  const canEdit = sessionAdminId === selectedAdminId;
  const selectedAdminName = admins.find((admin) => admin.id === selectedAdminId)?.name ?? '—';

  const rows = PLAN_MONTHS.map((monthKey) => ({
    monthKey,
    metrics: dataService.getPlanMetrics(selectedAdminId, monthKey)
  }));

  const parseNumberOrNull = (value: string): number | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  };

  return (
    <section>
      <h1>Планы</h1>
      <p>Плановые показатели по машинозаездам, среднему чеку и доп. услугам по каждому администратору.</p>

      <div className="toolbar-row">
        <label htmlFor="plan-admin-select">Администратор:</label>
        <select id="plan-admin-select" value={selectedAdminId} onChange={(event) => setSelectedAdminId(event.target.value)}>
          {admins.map((admin) => (
            <option key={admin.id} value={admin.id}>
              {admin.name}
            </option>
          ))}
        </select>
      </div>

      {!canEdit && (
        <div className="notice">
          Просмотр для администратора «{selectedAdminName}». Редактирование доступно только после входа под этим администратором.
        </div>
      )}

      <div className="simple-table-container">
        <table className="simple-table">
          <thead>
            <tr>
              <th>Месяц</th>
              <th>Машинозаезды (план)</th>
              <th>Средний чек (план)</th>
              <th>Воздушные фильтры, %</th>
              <th>Салонные фильтры, %</th>
              <th>Промывка, %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ monthKey, metrics }) => (
              <tr key={monthKey}>
                <td>{monthKey}</td>
                <PlanCell
                  value={metrics.car_entries_plan}
                  disabled={!canEdit}
                  onSave={(nextValue) => {
                    dataService.upsertPlanMetrics(selectedAdminId, monthKey, {
                      ...toPlanPayload(metrics),
                      car_entries_plan: parseNumberOrNull(nextValue)
                    });
                  }}
                />
                <PlanCell
                  value={metrics.average_check_plan}
                  disabled={!canEdit}
                  onSave={(nextValue) => {
                    dataService.upsertPlanMetrics(selectedAdminId, monthKey, {
                      ...toPlanPayload(metrics),
                      average_check_plan: parseNumberOrNull(nextValue)
                    });
                  }}
                />
                <PlanCell
                  value={metrics.air_filter_ratio_plan}
                  disabled={!canEdit}
                  onSave={(nextValue) => {
                    dataService.upsertPlanMetrics(selectedAdminId, monthKey, {
                      ...toPlanPayload(metrics),
                      air_filter_ratio_plan: parseNumberOrNull(nextValue)
                    });
                  }}
                />
                <PlanCell
                  value={metrics.cabin_filter_ratio_plan}
                  disabled={!canEdit}
                  onSave={(nextValue) => {
                    dataService.upsertPlanMetrics(selectedAdminId, monthKey, {
                      ...toPlanPayload(metrics),
                      cabin_filter_ratio_plan: parseNumberOrNull(nextValue)
                    });
                  }}
                />
                <PlanCell
                  value={metrics.flush_usage_ratio_plan}
                  disabled={!canEdit}
                  onSave={(nextValue) => {
                    dataService.upsertPlanMetrics(selectedAdminId, monthKey, {
                      ...toPlanPayload(metrics),
                      flush_usage_ratio_plan: parseNumberOrNull(nextValue)
                    });
                  }}
                />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

const PlanCell = ({
  value,
  disabled,
  onSave
}: {
  value: number | null;
  disabled: boolean;
  onSave: (value: string) => void;
}): JSX.Element => {
  const [draft, setDraft] = useState(value === null ? '' : String(value));

  useEffect(() => {
    setDraft(value === null ? '' : String(value));
  }, [value]);

  return (
    <td>
      <input
        className="plan-input"
        type="text"
        inputMode="decimal"
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => onSave(draft)}
      />
    </td>
  );
};
