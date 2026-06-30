import type { AdminUser, AppData, CellValue, Employee, EmployeeRole, MonthData, PlanMetrics, PlanRatioDefaults, ScheduleEntry, VacationRequest, WorkObject } from '../types';
import { firebaseConfig, isFirebaseConfigured } from './firebase';
import {
  getFirestoreV2MigrationStatus,
  migrateAppDataToFirestoreV2,
  pullAppDataFromFirestore,
  pushAppDataToFirestore
} from './firestoreRest';
import type { FirestoreV2MigrationStatus } from './firestoreRest';

const SUPER_ADMIN_ID = 'super-admin';

const createId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const createToken = (): string => Math.random().toString(36).slice(2, 12);
const DEFAULT_EMPLOYEE_ROLE: EmployeeRole = 'mechanic';

const FIRESTORE_PUSH_RETRY_MS = 2000;
const FIRESTORE_PULL_INTERVAL_MS = 15 * 60 * 1000;
const FIRESTORE_PULL_BACKOFF_MS = 60 * 60 * 1000;

export interface SyncState {
  configured: boolean;
  pendingPush: boolean;
  lastPushAt: number | null;
  lastPullAt: number | null;
  nextPullAllowedAt: number | null;
  lastError: string | null;
}

const defaultData: AppData = {
  admins: [{ id: SUPER_ADMIN_ID, name: 'Епиванов А В', password: 'admin2026', is_super: true }],
  employees: [
    { id: createId(), admin_id: SUPER_ADMIN_ID, full_name: 'Иванов Иван', active: true, token: createToken(), role: DEFAULT_EMPLOYEE_ROLE, primary_object_id: null },
    { id: createId(), admin_id: SUPER_ADMIN_ID, full_name: 'Петров Петр', active: true, token: createToken(), role: DEFAULT_EMPLOYEE_ROLE, primary_object_id: null }
  ],
  objects: [
    { id: createId(), admin_id: SUPER_ADMIN_ID, name_ru: 'Объект Север', short_ru: 'Север', active: true },
    { id: createId(), admin_id: SUPER_ADMIN_ID, name_ru: 'Объект Юг', short_ru: 'Юг', active: true }
  ],
  months: {},
  plans: {},
  plan_ratio_defaults: {},
  vacation_requests: []
};

const sanitizeEntry = (entry: ScheduleEntry): ScheduleEntry => {
  if (entry.kind === 'OBJECT') {
    return {
      kind: 'OBJECT',
      object_id: entry.object_id,
      ...(entry.object_role === 'ADMINISTRATOR' ? { object_role: 'ADMINISTRATOR' as const } : {})
    };
  }
  return { kind: 'SPECIAL', special: entry.special ?? 'OFF' };
};

const ensureDataShape = (input: unknown): AppData => {
  const maybe = input as AppData;
  if (!maybe || typeof maybe !== 'object') return structuredClone(defaultData);
  const admins = Array.isArray(maybe.admins) && maybe.admins.length > 0 ? maybe.admins : structuredClone(defaultData.admins);
  const normalizedAdmins = admins.map((admin) => (admin.id === SUPER_ADMIN_ID ? { ...admin, is_super: true } : admin));

  return {
    admins: normalizedAdmins,
    employees: Array.isArray(maybe.employees)
      ? maybe.employees.map((employee) => ({ ...employee, admin_id: employee.admin_id ?? SUPER_ADMIN_ID, role: employee.role ?? DEFAULT_EMPLOYEE_ROLE, primary_object_id: employee.primary_object_id ?? null }))
      : [],
    objects: Array.isArray(maybe.objects)
      ? maybe.objects.map((objectItem) => ({
          ...objectItem,
          admin_id: objectItem.admin_id ?? SUPER_ADMIN_ID,
          has_administrator: objectItem.has_administrator === true
        }))
      : [],
    months: maybe.months && typeof maybe.months === 'object' ? maybe.months : {},
    plans: maybe.plans && typeof maybe.plans === 'object' ? maybe.plans : {},
    plan_ratio_defaults: maybe.plan_ratio_defaults && typeof maybe.plan_ratio_defaults === 'object' ? maybe.plan_ratio_defaults : {},
    vacation_requests: Array.isArray(maybe.vacation_requests)
      ? maybe.vacation_requests.map((request) => ({ ...request, admin_id: request.admin_id ?? SUPER_ADMIN_ID }))
      : []
  };
};

let inMemoryData: AppData = structuredClone(defaultData);
let lastSnapshotFingerprint = '';

const computeSnapshotFingerprint = (data: AppData): string => JSON.stringify(data);

const changeListeners = new Set<() => void>();
let lastPushAt: number | null = null;
let lastError: string | null = null;

const emitDataChanged = (): void => {
  for (const listener of changeListeners) listener();
};

const setSyncError = (message: string | null): void => {
  if (lastError === message) return;
  lastError = message;
  emitDataChanged();
};

const getSyncState = (): SyncState => ({
  configured: isFirebaseConfigured(),
  pendingPush: Boolean(queuedRemoteSnapshot),
  lastPushAt,
  lastPullAt,
  nextPullAllowedAt: pullBackoffUntil,
  lastError
});

const updateLocalSnapshot = (data: AppData): void => {
  inMemoryData = ensureDataShape(data);
  lastSnapshotFingerprint = computeSnapshotFingerprint(inMemoryData);
};

const getFromStorage = (): AppData => {
  runInitialRemotePull();
  return inMemoryData;
};

let queuedRemoteSnapshot: AppData | null = null;
let remotePushInFlight = false;
let remotePushRetryTimer: ReturnType<typeof setTimeout> | undefined;
let localMutationVersion = 0;
let lastPullAt: number | null = null;
let pullBackoffUntil: number | null = null;

const flushRemoteQueue = async (): Promise<void> => {
  if (remotePushInFlight || !queuedRemoteSnapshot || !isFirebaseConfigured()) return;
  remotePushInFlight = true;
  const snapshot = queuedRemoteSnapshot;

  try {
    await pushAppDataToFirestore(firebaseConfig.projectId, firebaseConfig.apiKey, snapshot);
    if (queuedRemoteSnapshot === snapshot) queuedRemoteSnapshot = null;
    lastPushAt = Date.now();
    setSyncError(null);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка отправки в Firestore';
    setSyncError(message);
    if (remotePushRetryTimer === undefined) {
      remotePushRetryTimer = globalThis.setTimeout(() => {
        remotePushRetryTimer = undefined;
        void flushRemoteQueue();
      }, FIRESTORE_PUSH_RETRY_MS);
    }
  } finally {
    remotePushInFlight = false;
    if (queuedRemoteSnapshot) void flushRemoteQueue();
  }
};

const syncToRemote = (data: AppData): void => {
  if (!isFirebaseConfigured()) {
    setSyncError('Firebase не настроен: данные не сохраняются');
    return;
  }
  queuedRemoteSnapshot = structuredClone(data);
  setSyncError(null);
  emitDataChanged();
  void flushRemoteQueue();
};

const setToStorage = (data: AppData): void => {
  updateLocalSnapshot(data);
  localMutationVersion += 1;
  syncToRemote(data);
  emitDataChanged();
};


let remoteSyncStarted = false;

const runInitialRemotePull = (): void => {
  if (remoteSyncStarted || !isFirebaseConfigured()) return;
  remoteSyncStarted = true;

  const mutationVersionAtStart = localMutationVersion;

  pullAppDataFromFirestore(firebaseConfig.projectId, firebaseConfig.apiKey)
    .then((remoteData) => {
      if (localMutationVersion !== mutationVersionAtStart) return;

      if (remoteData) {
        const normalized = ensureDataShape(remoteData);
        updateLocalSnapshot(normalized);
        emitDataChanged();
        return;
      }

      syncToRemote(defaultData);
    })
    .catch(() => {
      // Firestore unreachable: keep only in-memory state for current session
    });
};

const monthStorageKey = (adminId: string, monthKey: string): string => `${adminId}__${monthKey}`;

const getMonth = (adminId: string, monthKey: string): MonthData => {
  const data = getFromStorage();
  return data.months[monthStorageKey(adminId, monthKey)] ?? { status: 'draft', entries: {} };
};

const getEntryKey = (employeeId: string, date: string): string => `${employeeId}_${date}`;

const getAdmins = (): AdminUser[] => getFromStorage().admins;

const upsertAdmin = (payload: Omit<AdminUser, 'id'> & { id?: string }): AdminUser => {
  const data = getFromStorage();
  if (payload.id) {
    data.admins = data.admins.map((admin) => (admin.id === payload.id ? { ...admin, ...payload } : admin));
    setToStorage(data);
    return data.admins.find((item) => item.id === payload.id)!;
  }

  const admin: AdminUser = { ...payload, id: createId() };
  data.admins.push(admin);
  setToStorage(data);
  return admin;
};

const removeAdmin = (adminId: string): void => {
  if (adminId === SUPER_ADMIN_ID) return;
  const data = getFromStorage();
  data.admins = data.admins.filter((admin) => admin.id !== adminId);
  data.employees = data.employees.filter((employee) => employee.admin_id !== adminId);
  data.objects = data.objects.filter((objectItem) => objectItem.admin_id !== adminId);
  data.vacation_requests = data.vacation_requests.filter((request) => request.admin_id !== adminId);
  for (const key of Object.keys(data.months)) {
    if (key.startsWith(`${adminId}__`)) delete data.months[key];
  }
  for (const key of Object.keys(data.plans)) {
    if (key.startsWith(`${adminId}__`)) delete data.plans[key];
  }
  delete data.plan_ratio_defaults[adminId];
  setToStorage(data);
};

const validateAdminPassword = (adminId: string, password: string): boolean => {
  const admin = getFromStorage().admins.find((item) => item.id === adminId);
  return Boolean(admin && admin.password === password);
};

const getEmployeesByAdmin = (adminId: string): Employee[] => getFromStorage().employees.filter((employee) => employee.admin_id === adminId);

const reorderEmployeesByAdmin = (adminId: string, orderedEmployeeIds: string[]): void => {
  const data = getFromStorage();
  const adminEmployees = data.employees.filter((employee) => employee.admin_id === adminId);
  if (adminEmployees.length <= 1) return;

  const employeesById = new Map(adminEmployees.map((employee) => [employee.id, employee]));
  const reorderedAdminEmployees = orderedEmployeeIds
    .map((id) => employeesById.get(id))
    .filter((employee): employee is Employee => Boolean(employee));

  if (reorderedAdminEmployees.length !== adminEmployees.length) return;

  let adminIndex = 0;
  data.employees = data.employees.map((employee) => {
    if (employee.admin_id !== adminId) return employee;
    const reordered = reorderedAdminEmployees[adminIndex];
    adminIndex += 1;
    return reordered;
  });

  setToStorage(data);
};

const getObjectsByAdmin = (adminId: string): WorkObject[] => getFromStorage().objects.filter((objectItem) => objectItem.admin_id === adminId);

const plansStorageKey = (adminId: string, objectId: string, monthKey: string): string => `${adminId}__${objectId}__${monthKey}`;

const getPlanRatioDefaults = (adminId: string): PlanRatioDefaults => {
  const defaults = getFromStorage().plan_ratio_defaults[adminId];
  return {
    air_filter_ratio: defaults?.air_filter_ratio ?? null,
    cabin_filter_ratio: defaults?.cabin_filter_ratio ?? null,
    flush_usage_ratio: defaults?.flush_usage_ratio ?? null,
    akpp_ratio: defaults?.akpp_ratio ?? null,
    partial_replacement_ratio: defaults?.partial_replacement_ratio ?? null,
    technical_fluids_ratio: defaults?.technical_fluids_ratio ?? null
  };
};

const upsertPlanRatioDefaults = (adminId: string, payload: PlanRatioDefaults): PlanRatioDefaults => {
  const data = getFromStorage();
  data.plan_ratio_defaults[adminId] = { ...payload };
  setToStorage(data);
  return data.plan_ratio_defaults[adminId];
};

const getPlanMetrics = (adminId: string, objectId: string, monthKey: string): PlanMetrics => {
  const fromStorage = getFromStorage().plans[plansStorageKey(adminId, objectId, monthKey)];
  const defaults = getPlanRatioDefaults(adminId);
  const legacy = fromStorage as (PlanMetrics & { additional_services_ratio_plan?: number | null; additional_services_ratio_fact?: number | null }) | undefined;
  return {
    month_key: monthKey,
    object_id: objectId,
    car_entries_plan: fromStorage?.car_entries_plan ?? null,
    car_entries_fact: fromStorage?.car_entries_fact ?? null,
    average_check_plan: fromStorage?.average_check_plan ?? null,
    average_check_fact: fromStorage?.average_check_fact ?? null,
    air_filter_ratio_plan: fromStorage?.air_filter_ratio_plan ?? defaults.air_filter_ratio,
    air_filter_ratio_fact: fromStorage?.air_filter_ratio_fact ?? defaults.air_filter_ratio,
    cabin_filter_ratio_plan: fromStorage?.cabin_filter_ratio_plan ?? defaults.cabin_filter_ratio,
    cabin_filter_ratio_fact: fromStorage?.cabin_filter_ratio_fact ?? defaults.cabin_filter_ratio,
    flush_usage_ratio_plan: fromStorage?.flush_usage_ratio_plan ?? defaults.flush_usage_ratio,
    flush_usage_ratio_fact: fromStorage?.flush_usage_ratio_fact ?? defaults.flush_usage_ratio,
    akpp_ratio_plan: fromStorage?.akpp_ratio_plan ?? defaults.akpp_ratio,
    akpp_ratio_fact: fromStorage?.akpp_ratio_fact ?? defaults.akpp_ratio,
    partial_replacement_ratio_plan: fromStorage?.partial_replacement_ratio_plan ?? defaults.partial_replacement_ratio,
    partial_replacement_ratio_fact: fromStorage?.partial_replacement_ratio_fact ?? defaults.partial_replacement_ratio,
    technical_fluids_ratio_plan: fromStorage?.technical_fluids_ratio_plan ?? defaults.technical_fluids_ratio,
    technical_fluids_ratio_fact: fromStorage?.technical_fluids_ratio_fact ?? defaults.technical_fluids_ratio,
    additional_services_amount_plan: fromStorage?.additional_services_amount_plan ?? legacy?.additional_services_ratio_plan ?? null,
    additional_services_amount_fact: fromStorage?.additional_services_amount_fact ?? legacy?.additional_services_ratio_fact ?? null
  };
};

const upsertPlanMetrics = (
  adminId: string,
  objectId: string,
  monthKey: string,
  payload: Omit<PlanMetrics, 'month_key' | 'object_id'>
): PlanMetrics => {
  const data = getFromStorage();
  const metrics: PlanMetrics = { month_key: monthKey, object_id: objectId, ...payload };
  data.plans[plansStorageKey(adminId, objectId, monthKey)] = metrics;
  setToStorage(data);
  return metrics;
};

const upsertEmployee = (
  payload: Omit<Employee, 'id' | 'token'> & { id?: string; token?: string; admin_id: string; role?: EmployeeRole; primary_object_id?: string | null }
): Employee => {
  const data = getFromStorage();
  if (payload.id) {
    data.employees = data.employees.map((employee) =>
      employee.id === payload.id
        ? { ...employee, full_name: payload.full_name, active: payload.active, token: payload.token ?? employee.token, role: payload.role ?? employee.role ?? DEFAULT_EMPLOYEE_ROLE, primary_object_id: payload.primary_object_id ?? employee.primary_object_id ?? null }
        : employee
    );
    setToStorage(data);
    return data.employees.find((item) => item.id === payload.id)!;
  }

  const employee: Employee = {
    id: createId(),
    admin_id: payload.admin_id,
    full_name: payload.full_name,
    active: payload.active,
    token: createToken(),
    role: payload.role ?? DEFAULT_EMPLOYEE_ROLE,
    primary_object_id: payload.primary_object_id ?? null
  };
  data.employees.push(employee);
  setToStorage(data);
  return employee;
};

const upsertObject = (payload: Omit<WorkObject, 'id'> & { id?: string; admin_id: string }): WorkObject => {
  const data = getFromStorage();
  if (payload.id) {
    data.objects = data.objects.map((objectItem) =>
      objectItem.id === payload.id
        ? {
            ...objectItem,
            name_ru: payload.name_ru,
            short_ru: payload.short_ru,
            active: payload.active,
            has_administrator: payload.has_administrator === true
          }
        : objectItem
    );
    setToStorage(data);
    return data.objects.find((item) => item.id === payload.id)!;
  }

  const objectItem: WorkObject = { id: createId(), ...payload };
  data.objects.push(objectItem);
  setToStorage(data);
  return objectItem;
};

const removeEmployee = (employeeId: string): void => {
  const data = getFromStorage();
  data.employees = data.employees.filter((employee) => employee.id !== employeeId);
  data.vacation_requests = data.vacation_requests.filter((request) => request.employee_id !== employeeId);
  for (const month of Object.values(data.months)) {
    for (const entryKey of Object.keys(month.entries)) {
      if (entryKey.startsWith(`${employeeId}_`)) delete month.entries[entryKey];
    }
  }
  setToStorage(data);
};

const removeObject = (objectId: string): void => {
  const data = getFromStorage();
  data.objects = data.objects.filter((objectItem) => objectItem.id !== objectId);
  data.employees = data.employees.map((employee) =>
    employee.primary_object_id === objectId ? { ...employee, primary_object_id: null } : employee
  );
  for (const month of Object.values(data.months)) {
    for (const [entryKey, entry] of Object.entries(month.entries)) {
      if (entry.kind === 'OBJECT' && entry.object_id === objectId) delete month.entries[entryKey];
    }
  }
  setToStorage(data);
};

const setEntry = (adminId: string, monthKey: string, employeeId: string, date: string, entry: ScheduleEntry): void => {
  const data = getFromStorage();
  const storageKey = monthStorageKey(adminId, monthKey);
  if (!data.months[storageKey]) data.months[storageKey] = { status: 'draft', entries: {} };
  data.months[storageKey].entries[getEntryKey(employeeId, date)] = sanitizeEntry(entry);
  setToStorage(data);
};

const replaceMonthEntries = (adminId: string, monthKey: string, entries: Record<string, ScheduleEntry>): void => {
  const data = getFromStorage();
  const storageKey = monthStorageKey(adminId, monthKey);
  if (!data.months[storageKey]) data.months[storageKey] = { status: 'draft', entries: {} };

  data.months[storageKey].entries = Object.fromEntries(
    Object.entries(entries).map(([entryKey, entry]) => [entryKey, sanitizeEntry(entry)])
  );

  setToStorage(data);
};

const clearEntry = (adminId: string, monthKey: string, employeeId: string, date: string): void => {
  const data = getFromStorage();
  const storageKey = monthStorageKey(adminId, monthKey);
  if (!data.months[storageKey]) return;
  delete data.months[storageKey].entries[getEntryKey(employeeId, date)];
  setToStorage(data);
};

const setMonthStatus = (adminId: string, monthKey: string, status: 'draft' | 'published'): void => {
  const data = getFromStorage();
  const storageKey = monthStorageKey(adminId, monthKey);
  if (!data.months[storageKey]) data.months[storageKey] = { status: 'draft', entries: {} };
  data.months[storageKey].status = status;
  setToStorage(data);
};

const publishMonth = (adminId: string, monthKey: string, dates: string[], employeeIds: string[]): void => {
  const data = getFromStorage();
  const storageKey = monthStorageKey(adminId, monthKey);
  if (!data.months[storageKey]) data.months[storageKey] = { status: 'draft', entries: {} };

  for (const employeeId of employeeIds) {
    for (const date of dates) {
      const key = getEntryKey(employeeId, date);
      if (!data.months[storageKey].entries[key]) data.months[storageKey].entries[key] = { kind: 'SPECIAL', special: 'OFF' };
    }
  }

  data.months[storageKey].status = 'published';
  setToStorage(data);
};

const extendMonthFromPrevious = (adminId: string, monthKey: string, employeeIds: string[]): boolean => {
  const [yearPart, monthPart] = monthKey.split('-');
  const year = Number(yearPart);
  const month = Number(monthPart);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return false;

  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;
  const previousMonthKey = `${previousYear}-${String(previousMonth).padStart(2, '0')}`;

  const data = getFromStorage();
  const sourceStorageKey = monthStorageKey(adminId, previousMonthKey);
  const sourceMonth = data.months[sourceStorageKey];
  if (!sourceMonth) return false;

  const targetStorageKey = monthStorageKey(adminId, monthKey);
  if (!data.months[targetStorageKey]) data.months[targetStorageKey] = { status: 'draft', entries: {} };

  const sourceDays = new Date(previousYear, previousMonth, 0).getDate();
  const targetDays = new Date(year, month, 0).getDate();

  const entryToToken = (entry: ScheduleEntry | undefined): string => {
    if (!entry) return '__EMPTY__';
    if (entry.kind === 'OBJECT') return `OBJECT:${entry.object_id ?? ''}:${entry.object_role ?? ''}`;
    return `SPECIAL:${entry.special ?? 'OFF'}`;
  };

  const detectCycleLength = (tokens: string[]): number => {
    for (let cycle = 1; cycle <= tokens.length; cycle += 1) {
      let matches = true;
      for (let index = 0; index < tokens.length; index += 1) {
        if (tokens[index] !== tokens[index % cycle]) {
          matches = false;
          break;
        }
      }
      if (matches) return cycle;
    }
    return tokens.length;
  };

  for (const employeeId of employeeIds) {
    const sourceEntriesByDay: Array<ScheduleEntry | undefined> = Array.from({ length: sourceDays }, (_, index) => {
      const sourceDate = `${previousMonthKey}-${String(index + 1).padStart(2, '0')}`;
      return sourceMonth.entries[getEntryKey(employeeId, sourceDate)];
    });

    const cycleLength = detectCycleLength(sourceEntriesByDay.map((entry) => entryToToken(entry)));
    const cycleEntries = sourceEntriesByDay.slice(0, cycleLength);

    for (let targetDay = 1; targetDay <= targetDays; targetDay += 1) {
      const cycleIndex = (sourceDays + targetDay - 1) % cycleLength;
      const sourceEntry = cycleEntries[cycleIndex];
      const targetDate = `${monthKey}-${String(targetDay).padStart(2, '0')}`;
      const targetEntryKey = getEntryKey(employeeId, targetDate);

      if (sourceEntry) {
        data.months[targetStorageKey].entries[targetEntryKey] = sanitizeEntry(sourceEntry);
      } else {
        delete data.months[targetStorageKey].entries[targetEntryKey];
      }
    }
  }

  setToStorage(data);
  return true;
};

const getVisibleEntryForEmployee = (adminId: string, monthKey: string, employeeId: string, date: string): ScheduleEntry | undefined => {
  const month = getMonth(adminId, monthKey);
  if (month.status !== 'published') return undefined;
  return month.entries[getEntryKey(employeeId, date)];
};

const getCellValue = (
  adminId: string,
  monthKey: string,
  employeeId: string,
  date: string
): CellValue => {
  const month = getMonth(adminId, monthKey);
  const entry = month.entries[getEntryKey(employeeId, date)];
  if (!entry) return { type: 'SPECIAL', value: 'OFF' };
  if (entry.kind === 'OBJECT' && entry.object_id) {
    return {
      type: entry.object_role === 'ADMINISTRATOR' ? 'ADMINISTRATOR' : 'OBJECT',
      value: entry.object_id
    };
  }
  return { type: 'SPECIAL', value: entry.special ?? 'OFF' };
};


const pullFromFirestore = async (): Promise<boolean> => {
  if (!isFirebaseConfigured()) {
    setSyncError('Firebase не настроен: чтение невозможно');
    return false;
  }
  remoteSyncStarted = true;

  try {
    const remoteData = await pullAppDataFromFirestore(firebaseConfig.projectId, firebaseConfig.apiKey);
    lastPullAt = Date.now();
    pullBackoffUntil = null;
    if (!remoteData) return false;

    const normalized = ensureDataShape(remoteData);
    const nextFingerprint = computeSnapshotFingerprint(normalized);
    if (nextFingerprint === lastSnapshotFingerprint) {
      setSyncError(null);
      emitDataChanged();
      return false;
    }

    updateLocalSnapshot(normalized);
    setSyncError(null);
    emitDataChanged();
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка чтения Firestore';
    if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
      pullBackoffUntil = Date.now() + FIRESTORE_PULL_BACKOFF_MS;
    }
    setSyncError(message);
    throw error;
  }
};

const getEmployeeByToken = (adminId: string, token: string): Employee | null => {
  const normalizedToken = token.trim();
  if (!normalizedToken) return null;
  return getFromStorage().employees.find((employee) => employee.admin_id === adminId && employee.active && employee.token === normalizedToken) ?? null;
};

const getVacationRequestsByAdmin = (adminId: string): VacationRequest[] =>
  getFromStorage()
    .vacation_requests.filter((request) => request.admin_id === adminId)
    .sort((left, right) => left.start_date.localeCompare(right.start_date));

const getVacationRequestByEmployeeAndMonth = (adminId: string, employeeId: string, monthKey: string): VacationRequest | null =>
  getFromStorage().vacation_requests.find(
    (request) => request.admin_id === adminId && request.employee_id === employeeId && request.month_key === monthKey
  ) ?? null;

const createVacationRequest = (payload: {
  admin_id: string;
  employee_id: string;
  month_key: string;
  start_date: string;
  end_date: string;
  vacation_days: number;
  created_by: 'employee' | 'admin';
}): VacationRequest => {
  const data = getFromStorage();
  const request: VacationRequest = {
    id: createId(),
    ...payload,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  data.vacation_requests.push(request);
  setToStorage(data);
  return request;
};

const updateVacationRequest = (
  requestId: string,
  payload: Pick<VacationRequest, 'start_date' | 'end_date' | 'vacation_days'> & { updatedBy: 'admin' }
): VacationRequest | null => {
  const data = getFromStorage();
  const request = data.vacation_requests.find((item) => item.id === requestId);
  if (!request) return null;
  request.start_date = payload.start_date;
  request.end_date = payload.end_date;
  request.vacation_days = payload.vacation_days;
  request.updated_at = new Date().toISOString();
  request.created_by = payload.updatedBy;
  setToStorage(data);
  return request;
};

const removeVacationRequest = (requestId: string): boolean => {
  const data = getFromStorage();
  const currentLength = data.vacation_requests.length;
  data.vacation_requests = data.vacation_requests.filter((item) => item.id !== requestId);
  if (data.vacation_requests.length === currentLength) return false;
  setToStorage(data);
  return true;
};

let realtimeSyncTimer: ReturnType<typeof setInterval> | undefined;
let realtimeSyncEventHandler: (() => void) | undefined;

const shouldPullFromFirestore = (): boolean => {
  const now = Date.now();
  if (pullBackoffUntil && now < pullBackoffUntil) return false;
  if (lastPullAt && now - lastPullAt < FIRESTORE_PULL_INTERVAL_MS) return false;
  return true;
};

const runThrottledRealtimePull = (): void => {
  if (!shouldPullFromFirestore()) return;
  void pullFromFirestore().catch(() => {
    // pullFromFirestore already stores the readable sync error.
  });
};

const startRealtimeSync = (): void => {
  if (realtimeSyncTimer || !isFirebaseConfigured()) return;


  realtimeSyncEventHandler = (): void => {
    if (document.visibilityState === 'visible') runThrottledRealtimePull();
    if (queuedRemoteSnapshot) void flushRemoteQueue();
  };

  globalThis.addEventListener('focus', realtimeSyncEventHandler);
  document.addEventListener('visibilitychange', realtimeSyncEventHandler);

  realtimeSyncTimer = globalThis.setInterval(() => {
    if (document.visibilityState === 'visible') runThrottledRealtimePull();
    if (queuedRemoteSnapshot) void flushRemoteQueue();
  }, FIRESTORE_PULL_INTERVAL_MS);
};

const stopRealtimeSync = (): void => {
  if (realtimeSyncEventHandler) {
    globalThis.removeEventListener('focus', realtimeSyncEventHandler);
    document.removeEventListener('visibilitychange', realtimeSyncEventHandler);
    realtimeSyncEventHandler = undefined;
  }

  if (!realtimeSyncTimer) return;
  globalThis.clearInterval(realtimeSyncTimer);
  realtimeSyncTimer = undefined;
};

const subscribeToChanges = (listener: () => void): (() => void) => {
  changeListeners.add(listener);
  return () => {
    changeListeners.delete(listener);
  };
};

const pushToFirestore = async (): Promise<void> => {
  if (!isFirebaseConfigured()) return;
  const payload = getFromStorage();
  await pushAppDataToFirestore(firebaseConfig.projectId, firebaseConfig.apiKey, payload);
};

const getV2MigrationStatus = async (): Promise<FirestoreV2MigrationStatus | null> => {
  if (!isFirebaseConfigured()) return null;
  return getFirestoreV2MigrationStatus(firebaseConfig.projectId, firebaseConfig.apiKey);
};

const migrateToFirestoreV2 = async (): Promise<FirestoreV2MigrationStatus> => {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase не настроен: миграция невозможна');
  }

  await pullFromFirestore();
  const payload = getFromStorage();
  return migrateAppDataToFirestoreV2(firebaseConfig.projectId, firebaseConfig.apiKey, payload);
};

export const dataService = {
  SUPER_ADMIN_ID,
  getAppData: getFromStorage,
  setAppData: setToStorage,
  getAdmins,
  upsertAdmin,
  removeAdmin,
  validateAdminPassword,
  getEmployeesByAdmin,
  reorderEmployeesByAdmin,
  getObjectsByAdmin,
  getPlanRatioDefaults,
  upsertPlanRatioDefaults,
  getPlanMetrics,
  upsertPlanMetrics,
  getMonth,
  upsertEmployee,
  upsertObject,
  removeEmployee,
  removeObject,
  setEntry,
  clearEntry,
  replaceMonthEntries,
  setMonthStatus,
  publishMonth,
  extendMonthFromPrevious,
  getCellValue,
  getEntryKey,
  getVisibleEntryForEmployee,
  getEmployeeByToken,
  getVacationRequestsByAdmin,
  getVacationRequestByEmployeeAndMonth,
  createVacationRequest,
  updateVacationRequest,
  removeVacationRequest,
  pullFromFirestore,
  pushToFirestore,
  getV2MigrationStatus,
  migrateToFirestoreV2,
  startRealtimeSync,
  stopRealtimeSync,
  subscribeToChanges,
  getSyncState
};
