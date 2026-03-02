import { useEffect, useState } from 'react';
import { dataService } from '../services/dataService';
import { getAdminSessionId } from '../utils/adminAuth';

const PLAN_MONTHS = Array.from({ length: 12 }, (_, index) => `2026-${String(index + 1).padStart(2, '0')}`);

const getDefaultMonthKey = (): string => {
  const now = new Date();
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return PLAN_MONTHS.includes(key) ? key : PLAN_MONTHS[0];
};

type MetricRow = {
  key: 'car_entries' | 'average_check' | 'air_filter_ratio' | 'cabin_filter_ratio' | 'flush_usage_ratio';
  label: string;
  unit: string;
  isRatioFromCarEntries?: boolean;
};

const METRIC_ROWS: MetricRow[] = [
  { key: 'car_entries', label: 'Машинозаезды', unit: 'шт' },
  { key: 'average_check', label: 'Средний чек', unit: '₽' },
  { key: 'air_filter_ratio', label: 'Воздушные фильтры', unit: '%', isRatioFromCarEntries: true },
  { key: 'cabin_filter_ratio', label: 'Салонные фильтры', unit: '%', isRatioFromCarEntries: true },
  { key: 'flush_usage_ratio', label: 'Промывка', unit: '%', isRatioFromCarEntries: true }
];

const toPayload = (metrics: ReturnType<typeof dataService.getPlanMetrics>) => ({
  car_entries_plan: metrics.car_entries_plan,
  car_entries_fact: metrics.car_entries_fact,
  average_check_plan: metrics.average_check_plan,
  average_check_fact: metrics.average_check_fact,
  air_filter_ratio_plan: metrics.air_filter_ratio_plan,
  air_filter_ratio_fact: metrics.air_filter_ratio_fact,
  cabin_filter_ratio_plan: metrics.cabin_filter_ratio_plan,
  cabin_filter_ratio_fact: metrics.cabin_filter_ratio_fact,
  flush_usage_ratio_plan: metrics.flush_usage_ratio_plan,
  flush_usage_ratio_fact: metrics.flush_usage_ratio_fact
});

const parseNumberOrNull = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

const parseNumericToken = (value: string): number | null => {
  const cleaned = value.replace(/шт|%|₽/gi, '').trim();
  return parseNumberOrNull(cleaned);
};

const formatNumber = (value: number): string =>
  new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2
  }).format(value);

const calculateCountFromRatio = (base: number | null, ratio: number | null): number | null => {
  if (base === null || ratio === null) return null;
  return (base * ratio) / 100;
};

const calculateRatioFromCount = (base: number | null, count: number | null): number | null => {
  if (base === null || base === 0 || count === null) return null;
  return (count / base) * 100;
};

const formatDeviationValue = (plan: number | null, fact: number | null, unit: string): string => {
  if (plan === null || fact === null) return '—';
  const delta = fact - plan;
  const deltaSign = delta > 0 ? '+' : '';
  const absPart = `${deltaSign}${formatNumber(delta)} ${unit}`;

  if (plan === 0) return `${absPart}; %: —`;

  const pct = (delta / plan) * 100;
  const pctSign = pct > 0 ? '+' : '';
  return `${absPart}; ${pctSign}${formatNumber(pct)}%`;
};

const formatDeviationForRow = (row: MetricRow, metrics: ReturnType<typeof dataService.getPlanMetrics>): string => {
  const planKey = `${row.key}_plan` as const;
  const factKey = `${row.key}_fact` as const;
  const planValue = metrics[planKey];
  const factValue = metrics[factKey];

  const ratioDeviation = formatDeviationValue(planValue, factValue, row.unit);
  if (!row.isRatioFromCarEntries) return ratioDeviation;

  const planCount = calculateCountFromRatio(metrics.car_entries_plan, planValue);
  const factCount = calculateCountFromRatio(metrics.car_entries_fact, factValue);
  const countDeviation = formatDeviationValue(planCount, factCount, 'шт');
  return `${ratioDeviation} | ${countDeviation}`;
};

export const PlansPage = (): JSX.Element => {
  const admins = dataService.getAdmins();
  const [selectedAdminId, setSelectedAdminId] = useState(admins[0]?.id ?? dataService.SUPER_ADMIN_ID);
  const [selectedMonthKey, setSelectedMonthKey] = useState(getDefaultMonthKey);
  const [selectedObjectId, setSelectedObjectId] = useState('');
  const sessionAdminId = getAdminSessionId();

  const objects = dataService.getObjectsByAdmin(selectedAdminId).filter((item) => item.active);

  useEffect(() => {
    if (!objects.some((item) => item.id === selectedObjectId)) {
      setSelectedObjectId(objects[0]?.id ?? '');
    }
  }, [objects, selectedObjectId]);

  const canEdit = sessionAdminId === selectedAdminId;
  const selectedAdminName = admins.find((admin) => admin.id === selectedAdminId)?.name ?? '—';

  if (!selectedObjectId) {
    return (
      <section>
        <h1>Планы</h1>
        <p>Для выбранного администратора нет активных объектов. Добавьте объект, чтобы задавать планы.</p>
      </section>
    );
  }

  const metrics = dataService.getPlanMetrics(selectedAdminId, selectedObjectId, selectedMonthKey);

  return (
    <section>
      <h1>Планы</h1>
      <p>Для фильтров и промывки отдельно заполняйте % или количество (шт) — второе поле система рассчитает автоматически.</p>

      <div className="toolbar-row">
        <label htmlFor="plan-admin-select">Администратор:</label>
        <select id="plan-admin-select" value={selectedAdminId} onChange={(event) => setSelectedAdminId(event.target.value)}>
          {admins.map((admin) => (
            <option key={admin.id} value={admin.id}>
              {admin.name}
            </option>
          ))}
        </select>

        <label htmlFor="plan-object-select">Объект:</label>
        <select id="plan-object-select" value={selectedObjectId} onChange={(event) => setSelectedObjectId(event.target.value)}>
          {objects.map((objectItem) => (
            <option key={objectItem.id} value={objectItem.id}>
              {objectItem.name_ru}
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

      {!canEdit && <div className="notice">Просмотр для администратора «{selectedAdminName}». Редактирование только после входа.</div>}

      <div className="simple-table-container">
        <table className="simple-table plans-table">
          <thead>
            <tr>
              <th rowSpan={2}>Показатель</th>
              <th className="plans-group-header" colSpan={2}>
                План
              </th>
              <th className="plans-group-header" colSpan={2}>
                Факт
              </th>
              <th rowSpan={2}>Отклонение</th>
            </tr>
            <tr>
              <th>%</th>
              <th>Кол-во (шт)</th>
              <th>%</th>
              <th>Кол-во (шт)</th>
            </tr>
          </thead>
          <tbody>
            {METRIC_ROWS.map((row) => {
              const planKey = `${row.key}_plan` as const;
              const factKey = `${row.key}_fact` as const;
              const planValue = metrics[planKey];
              const factValue = metrics[factKey];
              const planCount = row.isRatioFromCarEntries ? calculateCountFromRatio(metrics.car_entries_plan, planValue) : planValue;
              const factCount = row.isRatioFromCarEntries ? calculateCountFromRatio(metrics.car_entries_fact, factValue) : factValue;

              return (
                <tr key={row.key}>
                  <td>{row.label}</td>

                  <PlanCell
                    value={row.isRatioFromCarEntries ? (planValue === null ? '' : `${formatNumber(planValue)}%`) : '—'}
                    disabled={!canEdit || !row.isRatioFromCarEntries}
                    placeholder={row.isRatioFromCarEntries ? '%' : ''}
                    onSave={(nextValue) => {
                      if (!row.isRatioFromCarEntries) return;
                      dataService.upsertPlanMetrics(selectedAdminId, selectedObjectId, selectedMonthKey, {
                        ...toPayload(metrics),
                        [planKey]: parseNumericToken(nextValue)
                      });
                    }}
                  />
                  <PlanCell
                    value={planCount === null ? '' : `${formatNumber(planCount)} шт`}
                    disabled={!canEdit}
                    placeholder="шт"
                    onSave={(nextValue) => {
                      dataService.upsertPlanMetrics(selectedAdminId, selectedObjectId, selectedMonthKey, {
                        ...toPayload(metrics),
                        [planKey]: row.isRatioFromCarEntries
                          ? calculateRatioFromCount(metrics.car_entries_plan, parseNumericToken(nextValue))
                          : parseNumericToken(nextValue)
                      });
                    }}
                  />

                  <PlanCell
                    value={row.isRatioFromCarEntries ? (factValue === null ? '' : `${formatNumber(factValue)}%`) : '—'}
                    disabled={!canEdit || !row.isRatioFromCarEntries}
                    placeholder={row.isRatioFromCarEntries ? '%' : ''}
                    onSave={(nextValue) => {
                      if (!row.isRatioFromCarEntries) return;
                      dataService.upsertPlanMetrics(selectedAdminId, selectedObjectId, selectedMonthKey, {
                        ...toPayload(metrics),
                        [factKey]: parseNumericToken(nextValue)
                      });
                    }}
                  />
                  <PlanCell
                    value={factCount === null ? '' : `${formatNumber(factCount)} шт`}
                    disabled={!canEdit}
                    placeholder="шт"
                    onSave={(nextValue) => {
                      dataService.upsertPlanMetrics(selectedAdminId, selectedObjectId, selectedMonthKey, {
                        ...toPayload(metrics),
                        [factKey]: row.isRatioFromCarEntries
                          ? calculateRatioFromCount(metrics.car_entries_fact, parseNumericToken(nextValue))
                          : parseNumericToken(nextValue)
                      });
                    }}
                  />

                  <td>{formatDeviationForRow(row, metrics)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

const PlanCell = ({
  value,
  disabled,
  onSave,
  placeholder = ''
}: {
  value: string;
  disabled: boolean;
  onSave: (value: string) => void;
  placeholder?: string;
}): JSX.Element => {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <td>
      <input
        className="plan-input"
        type="text"
        inputMode="decimal"
        value={draft}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => onSave(draft)}
      />
    </td>
  );
};
