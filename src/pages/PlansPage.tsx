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
  { key: 'air_filter_ratio', label: 'Воздушные фильтры (%)', unit: '%', isRatioFromCarEntries: true },
  { key: 'cabin_filter_ratio', label: 'Салонные фильтры (%)', unit: '%', isRatioFromCarEntries: true },
  { key: 'flush_usage_ratio', label: 'Промывка (%)', unit: '%', isRatioFromCarEntries: true }
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

const formatNumber = (value: number): string =>
  new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2
  }).format(value);


const parseNumericToken = (value: string): number | null => {
  const cleaned = value.replace(/шт|%/gi, '').trim();
  return parseNumberOrNull(cleaned);
};

const calculateCountFromRatio = (base: number | null, ratio: number | null): number | null => {
  if (base === null || ratio === null) return null;
  return (base * ratio) / 100;
};

const calculateRatioFromCount = (base: number | null, count: number | null): number | null => {
  if (base === null || base === 0 || count === null) return null;
  return (count / base) * 100;
};

const formatRatioCellValue = (ratio: number | null, base: number | null): string => {
  if (ratio === null && base === null) return '';
  const count = calculateCountFromRatio(base, ratio);
  const ratioText = ratio === null ? '' : `${formatNumber(ratio)}%`;
  const countText = count === null ? '' : `${formatNumber(count)} шт`;
  if (!ratioText && !countText) return '';
  return `${ratioText} / ${countText}`;
};

const parseRatioInputToPercent = (value: string, base: number | null): number | null => {
  const normalized = value.trim();
  if (!normalized) return null;

  if (!normalized.includes('/')) return parseNumericToken(normalized);

  const [leftRaw, rightRaw] = normalized.split('/').map((item) => item.trim());
  const percentPart = parseNumericToken(leftRaw);
  if (percentPart !== null) return percentPart;

  const quantityPart = parseNumericToken(rightRaw);
  return calculateRatioFromCount(base, quantityPart);
};

const formatDeviation = (plan: number | null, fact: number | null, unit: string): string => {
  if (plan === null || fact === null) return '—';
  const delta = fact - plan;
  const deltaSign = delta > 0 ? '+' : '';
  const absPart = `${deltaSign}${formatNumber(delta)} ${unit}`;

  if (plan === 0) return `${absPart}; %: —`;

  const pct = (delta / plan) * 100;
  const pctSign = pct > 0 ? '+' : '';
  return `${absPart}; ${pctSign}${formatNumber(pct)}%`;
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
      <p>Для фильтров и промывки можно вводить «% / количество» или «/ количество» — система пересчитает процент от машинозаездов.</p>

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

      {!canEdit && (
        <div className="notice">
          Просмотр для администратора «{selectedAdminName}». Редактирование доступно только после входа под этим администратором.
        </div>
      )}

      <div className="simple-table-container">
        <table className="simple-table">
          <thead>
            <tr>
              <th>Наименование показателя</th>
              <th>Планируемые показатели</th>
              <th>Фактические</th>
              <th>Отклонение</th>
            </tr>
          </thead>
          <tbody>
            {METRIC_ROWS.map((row) => {
              const planKey = `${row.key}_plan` as const;
              const factKey = `${row.key}_fact` as const;
              const planValue = metrics[planKey];
              const factValue = metrics[factKey];

              return (
                <tr key={row.key}>
                  <td>{row.label}</td>
                  {row.isRatioFromCarEntries ? (
                    <>
                      <RatioCell
                        value={formatRatioCellValue(planValue, metrics.car_entries_plan)}
                        base={metrics.car_entries_plan}
                        disabled={!canEdit}
                        onSave={(nextValue) => {
                          dataService.upsertPlanMetrics(selectedAdminId, selectedObjectId, selectedMonthKey, {
                            ...toPayload(metrics),
                            [planKey]: parseRatioInputToPercent(nextValue, metrics.car_entries_plan)
                          });
                        }}
                      />
                      <RatioCell
                        value={formatRatioCellValue(factValue, metrics.car_entries_fact)}
                        base={metrics.car_entries_fact}
                        disabled={!canEdit}
                        onSave={(nextValue) => {
                          dataService.upsertPlanMetrics(selectedAdminId, selectedObjectId, selectedMonthKey, {
                            ...toPayload(metrics),
                            [factKey]: parseRatioInputToPercent(nextValue, metrics.car_entries_fact)
                          });
                        }}
                      />
                    </>
                  ) : (
                    <>
                      <PlanCell
                        value={planValue === null ? '' : String(planValue)}
                        disabled={!canEdit}
                        onSave={(nextValue) => {
                          dataService.upsertPlanMetrics(selectedAdminId, selectedObjectId, selectedMonthKey, {
                            ...toPayload(metrics),
                            [planKey]: parseNumberOrNull(nextValue)
                          });
                        }}
                      />
                      <PlanCell
                        value={factValue === null ? '' : String(factValue)}
                        disabled={!canEdit}
                        onSave={(nextValue) => {
                          dataService.upsertPlanMetrics(selectedAdminId, selectedObjectId, selectedMonthKey, {
                            ...toPayload(metrics),
                            [factKey]: parseNumberOrNull(nextValue)
                          });
                        }}
                      />
                    </>
                  )}
                  <td>{formatDeviation(planValue, factValue, row.unit)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

const PlanCell = ({ value, disabled, onSave }: { value: string; disabled: boolean; onSave: (value: string) => void }): JSX.Element => {
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
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => onSave(draft)}
      />
    </td>
  );
};

const RatioCell = ({
  value,
  base,
  disabled,
  onSave
}: {
  value: string;
  base: number | null;
  disabled: boolean;
  onSave: (value: string) => void;
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
        disabled={disabled}
        placeholder={base === null ? 'Сначала заполните машинозаезды' : '30% / 30 шт'}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => onSave(draft)}
      />
    </td>
  );
};
