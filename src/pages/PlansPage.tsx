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
  const [selectedMonthKey, setSelectedMonthKey] = useState(PLAN_MONTHS[0]);
  const sessionAdminId = getAdminSessionId();

  const canEdit = sessionAdminId === selectedAdminId;
  const selectedAdminName = admins.find((admin) => admin.id === selectedAdminId)?.name ?? '—';
  const metrics = dataService.getPlanMetrics(selectedAdminId, selectedMonthKey);

  const parseNumberOrNull = (value: string): number | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  };

  return (
    <section>
      <h1>Планы</h1>
      <p>Плановые показатели по машинозаездам, среднему чеку и доп. услугам. Отображение помесячное.</p>

      <div className="toolbar-row">
        <label htmlFor="plan-admin-select">Администратор:</label>
        <select id="plan-admin-select" value={selectedAdminId} onChange={(event) => setSelectedAdminId(event.target.value)}>
          {admins.map((admin) => (
            <option key={admin.id} value={admin.id}>
              {admin.name}
            </option>
          ))}
        </select>

        <label htmlFor="plan-month-select">Месяц:</label>
        <select id="plan-month-select" value={selectedMonthKey} onChange={(event) => setSelectedMonthKey(event.target.value)}>
          {PLAN_MONTHS.map((monthKey) => (
            <option key={monthKey} value={monthKey}>
              {monthKey}
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
            <tr key={selectedMonthKey}>
              <td>{selectedMonthKey}</td>
              <PlanCell
                value={metrics.car_entries_plan}
                disabled={!canEdit}
                onSave={(nextValue) => {
                  dataService.upsertPlanMetrics(selectedAdminId, selectedMonthKey, {
                    ...toPlanPayload(metrics),
                    car_entries_plan: parseNumberOrNull(nextValue)
                  });
                }}
              />
              <PlanCell
                value={metrics.average_check_plan}
                disabled={!canEdit}
                onSave={(nextValue) => {
                  dataService.upsertPlanMetrics(selectedAdminId, selectedMonthKey, {
                    ...toPlanPayload(metrics),
                    average_check_plan: parseNumberOrNull(nextValue)
                  });
                }}
              />
              <PlanCell
                value={metrics.air_filter_ratio_plan}
                disabled={!canEdit}
                onSave={(nextValue) => {
                  dataService.upsertPlanMetrics(selectedAdminId, selectedMonthKey, {
                    ...toPlanPayload(metrics),
                    air_filter_ratio_plan: parseNumberOrNull(nextValue)
                  });
                }}
              />
              <PlanCell
                value={metrics.cabin_filter_ratio_plan}
                disabled={!canEdit}
                onSave={(nextValue) => {
                  dataService.upsertPlanMetrics(selectedAdminId, selectedMonthKey, {
                    ...toPlanPayload(metrics),
                    cabin_filter_ratio_plan: parseNumberOrNull(nextValue)
                  });
                }}
              />
              <PlanCell
                value={metrics.flush_usage_ratio_plan}
                disabled={!canEdit}
                onSave={(nextValue) => {
                  dataService.upsertPlanMetrics(selectedAdminId, selectedMonthKey, {
                    ...toPlanPayload(metrics),
                    flush_usage_ratio_plan: parseNumberOrNull(nextValue)
                  });
                }}
              />
            </tr>
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
