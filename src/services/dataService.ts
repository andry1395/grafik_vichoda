import type { AdminUser, AppData, Employee, MonthData, ScheduleEntry, SpecialValue, WorkObject } from '../types';
import { STORAGE_KEY } from '../utils/constants';

const SUPER_ADMIN_ID = 'super-admin';

const createId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const createToken = (): string => Math.random().toString(36).slice(2, 12);

const defaultData: AppData = {
  admins: [{ id: SUPER_ADMIN_ID, name: 'Епиванов А В', password: 'admin2026', is_super: true }],
  employees: [
    { id: createId(), admin_id: SUPER_ADMIN_ID, full_name: 'Иванов Иван', active: true, token: createToken() },
    { id: createId(), admin_id: SUPER_ADMIN_ID, full_name: 'Петров Петр', active: true, token: createToken() }
  ],
  objects: [
    { id: createId(), admin_id: SUPER_ADMIN_ID, name_ru: 'Объект Север', short_ru: 'Север', active: true },
    { id: createId(), admin_id: SUPER_ADMIN_ID, name_ru: 'Объект Юг', short_ru: 'Юг', active: true }
  ],
  months: {}
};

const sanitizeEntry = (entry: ScheduleEntry): ScheduleEntry => {
  if (entry.kind === 'OBJECT') return { kind: 'OBJECT', object_id: entry.object_id };
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
      ? maybe.employees.map((employee) => ({ ...employee, admin_id: employee.admin_id ?? SUPER_ADMIN_ID }))
      : [],
    objects: Array.isArray(maybe.objects)
      ? maybe.objects.map((objectItem) => ({ ...objectItem, admin_id: objectItem.admin_id ?? SUPER_ADMIN_ID }))
      : [],
    months: maybe.months && typeof maybe.months === 'object' ? maybe.months : {}
  };
};

const getFromStorage = (): AppData => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultData));
    return structuredClone(defaultData);
  }
  try {
    return ensureDataShape(JSON.parse(raw));
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultData));
    return structuredClone(defaultData);
  }
};

const setToStorage = (data: AppData): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
  for (const key of Object.keys(data.months)) {
    if (key.startsWith(`${adminId}__`)) delete data.months[key];
  }
  setToStorage(data);
};

const validateAdminPassword = (adminId: string, password: string): boolean => {
  const admin = getFromStorage().admins.find((item) => item.id === adminId);
  return Boolean(admin && admin.password === password);
};

const getEmployeesByAdmin = (adminId: string): Employee[] => getFromStorage().employees.filter((employee) => employee.admin_id === adminId);

const getObjectsByAdmin = (adminId: string): WorkObject[] => getFromStorage().objects.filter((objectItem) => objectItem.admin_id === adminId);

const upsertEmployee = (
  payload: Omit<Employee, 'id' | 'token'> & { id?: string; token?: string; admin_id: string }
): Employee => {
  const data = getFromStorage();
  if (payload.id) {
    data.employees = data.employees.map((employee) =>
      employee.id === payload.id ? { ...employee, full_name: payload.full_name, active: payload.active, token: payload.token ?? employee.token } : employee
    );
    setToStorage(data);
    return data.employees.find((item) => item.id === payload.id)!;
  }

  const employee: Employee = {
    id: createId(),
    admin_id: payload.admin_id,
    full_name: payload.full_name,
    active: payload.active,
    token: createToken()
  };
  data.employees.push(employee);
  setToStorage(data);
  return employee;
};

const upsertObject = (payload: Omit<WorkObject, 'id'> & { id?: string; admin_id: string }): WorkObject => {
  const data = getFromStorage();
  if (payload.id) {
    data.objects = data.objects.map((objectItem) =>
      objectItem.id === payload.id ? { ...objectItem, name_ru: payload.name_ru, short_ru: payload.short_ru, active: payload.active } : objectItem
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
): { type: 'OBJECT'; value: string } | { type: 'SPECIAL'; value: SpecialValue } => {
  const month = getMonth(adminId, monthKey);
  const entry = month.entries[getEntryKey(employeeId, date)];
  if (!entry) return { type: 'SPECIAL', value: 'OFF' };
  if (entry.kind === 'OBJECT' && entry.object_id) return { type: 'OBJECT', value: entry.object_id };
  return { type: 'SPECIAL', value: entry.special ?? 'OFF' };
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
  getObjectsByAdmin,
  getMonth,
  upsertEmployee,
  upsertObject,
  removeEmployee,
  removeObject,
  setEntry,
  clearEntry,
  setMonthStatus,
  publishMonth,
  getCellValue,
  getEntryKey,
  getVisibleEntryForEmployee
};
