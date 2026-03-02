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
  key: 'car_entries' | 'average_check' | 'air_filter_ratio' | 'cabin_filter_ratio' | 'flush_usage_ratio' | 'akpp_ratio' | 'partial_replacement_ratio' | 'technical_fluids_ratio' | 'additional_services_amount';
  label: string;
  unit: string;
  isRatioFromCarEntries?: boolean;
};


const DEFAULT_RATIO_FIELDS: Array<{ key: keyof ReturnType<typeof dataService.getPlanRatioDefaults>; label: string }> = [
  { key: 'air_filter_ratio', label: 'Воздушные фильтры, %' },
  { key: 'cabin_filter_ratio', label: 'Салонные фильтры, %' },
  { key: 'flush_usage_ratio', label: 'Промывка, %' },
  { key: 'akpp_ratio', label: 'АКПП, %' },
  { key: 'partial_replacement_ratio', label: 'Частичные замены, %' },
  { key: 'technical_fluids_ratio', label: 'Т/Ж, %' }
];

const METRIC_ROWS: MetricRow[] = [
  { key: 'car_entries', label: 'Машинозаезды', unit: 'шт' },
  { key: 'average_check', label: 'Средний чек', unit: '₽' },
  { key: 'air_filter_ratio', label: 'Воздушные фильтры', unit: '%', isRatioFromCarEntries: true },
  { key: 'cabin_filter_ratio', label: 'Салонные фильтры', unit: '%', isRatioFromCarEntries: true },
  { key: 'flush_usage_ratio', label: 'Промывка', unit: '%', isRatioFromCarEntries: true },
  { key: 'akpp_ratio', label: 'АКПП', unit: '%', isRatioFromCarEntries: true },
  { key: 'partial_replacement_ratio', label: 'Частичные замены', unit: '%', isRatioFromCarEntries: true },
  { key: 'technical_fluids_ratio', label: 'Т/Ж', unit: '%', isRatioFromCarEntries: true },
  { key: 'additional_services_amount', label: 'Доп. услуги', unit: '₽' }
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
  flush_usage_ratio_fact: metrics.flush_usage_ratio_fact,
  akpp_ratio_plan: metrics.akpp_ratio_plan,
  akpp_ratio_fact: metrics.akpp_ratio_fact,
  partial_replacement_ratio_plan: metrics.partial_replacement_ratio_plan,
  partial_replacement_ratio_fact: metrics.partial_replacement_ratio_fact,
  technical_fluids_ratio_plan: metrics.technical_fluids_ratio_plan,
  technical_fluids_ratio_fact: metrics.technical_fluids_ratio_fact,
  additional_services_amount_plan: metrics.additional_services_amount_plan,
  additional_services_amount_fact: metrics.additional_services_amount_fact
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
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(Math.round(value));

const calculateCountFromRatio = (base: number | null, ratio: number | null): number | null => {
  if (base === null || ratio === null) return null;
  return (base * ratio) / 100;
};

const calculateRatioFromCount = (base: number | null, count: number | null): number | null => {
  if (base === null || base === 0 || count === null) return null;
  return (count / base) * 100;
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
  const [defaultsDraft, setDefaultsDraft] = useState(() => dataService.getPlanRatioDefaults(selectedAdminId));

  useEffect(() => {
    setDefaultsDraft(dataService.getPlanRatioDefaults(selectedAdminId));
  }, [selectedAdminId]);

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

      <div className="summary-card">
        <h3>Дефолтная процентовка услуг (для всех объектов администратора)</h3>
        <div className="toolbar-row">
          {DEFAULT_RATIO_FIELDS.map((field) => (
            <label key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span>{field.label}</span>
              <input
                className="plan-input"
                type="text"
                inputMode="decimal"
                value={defaultsDraft[field.key] === null ? '' : String(defaultsDraft[field.key])}
                disabled={!canEdit}
                placeholder="%"
                onChange={(event) => {
                  const nextValue = parseNumberOrNull(event.target.value);
                  setDefaultsDraft((prev) => ({ ...prev, [field.key]: nextValue }));
                }}
                onBlur={() => {
                  dataService.upsertPlanRatioDefaults(selectedAdminId, defaultsDraft);
                }}
              />
            </label>
          ))}
        </div>
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
              </tr>
            <tr>
              <th>%</th>
              <th>Количество / сумма</th>
              <th>%</th>
              <th>Количество / сумма</th>
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
              const valueUnitLabel = row.isRatioFromCarEntries ? 'шт' : row.unit;

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
                    value={planCount === null ? '' : `${formatNumber(planCount)} ${valueUnitLabel}`}
                    disabled={!canEdit}
                    placeholder={valueUnitLabel}
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
                    value={factCount === null ? '' : `${formatNumber(factCount)} ${valueUnitLabel}`}
                    disabled={!canEdit}
                    placeholder={valueUnitLabel}
                    onSave={(nextValue) => {
                      dataService.upsertPlanMetrics(selectedAdminId, selectedObjectId, selectedMonthKey, {
                        ...toPayload(metrics),
                        [factKey]: row.isRatioFromCarEntries
                          ? calculateRatioFromCount(metrics.car_entries_fact, parseNumericToken(nextValue))
                          : parseNumericToken(nextValue)
                      });
                    }}
                  />
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
