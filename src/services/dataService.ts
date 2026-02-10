import type { AppData, Employee, MonthData, ScheduleEntry, SpecialValue, WorkObject } from '../types';
import { STORAGE_KEY } from '../utils/constants';

const createId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const createToken = (): string => Math.random().toString(36).slice(2, 12);

const defaultData: AppData = {
  employees: [
    { id: createId(), full_name: 'Иванов Иван', active: true, token: createToken() },
    { id: createId(), full_name: 'Петров Петр', active: true, token: createToken() }
  ],
  objects: [
    { id: createId(), name_ru: 'Объект Север', short_ru: 'Север', active: true },
    { id: createId(), name_ru: 'Объект Юг', short_ru: 'Юг', active: true }
  ],
  months: {}
};

const sanitizeEntry = (entry: ScheduleEntry): ScheduleEntry => {
  if (entry.kind === 'OBJECT') {
    return { kind: 'OBJECT', object_id: entry.object_id };
  }
  return { kind: 'SPECIAL', special: entry.special ?? 'OFF' };
};

const ensureDataShape = (input: unknown): AppData => {
  const maybe = input as AppData;
  if (!maybe || typeof maybe !== 'object') return structuredClone(defaultData);
  return {
    employees: Array.isArray(maybe.employees) ? maybe.employees : [],
    objects: Array.isArray(maybe.objects) ? maybe.objects : [],
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

const getMonth = (monthKey: string): MonthData => {
  const data = getFromStorage();
  return data.months[monthKey] ?? { status: 'draft', entries: {} };
};

const getEntryKey = (employeeId: string, date: string): string => `${employeeId}_${date}`;

const upsertEmployee = (payload: Omit<Employee, 'id' | 'token'> & { id?: string; token?: string }): Employee => {
  const data = getFromStorage();
  if (payload.id) {
    data.employees = data.employees.map((employee) =>
      employee.id === payload.id
        ? { ...employee, full_name: payload.full_name, active: payload.active, token: payload.token ?? employee.token }
        : employee
    );
    setToStorage(data);
    return data.employees.find((item) => item.id === payload.id)!;
  }
  const employee: Employee = {
    id: createId(),
    full_name: payload.full_name,
    active: payload.active,
    token: createToken()
  };
  data.employees.push(employee);
  setToStorage(data);
  return employee;
};

const upsertObject = (payload: Omit<WorkObject, 'id'> & { id?: string }): WorkObject => {
  const data = getFromStorage();
  if (payload.id) {
    data.objects = data.objects.map((objectItem) =>
      objectItem.id === payload.id
        ? {
            ...objectItem,
            name_ru: payload.name_ru,
            short_ru: payload.short_ru,
            active: payload.active
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

const setEntry = (monthKey: string, employeeId: string, date: string, entry: ScheduleEntry): void => {
  const data = getFromStorage();
  if (!data.months[monthKey]) {
    data.months[monthKey] = { status: 'draft', entries: {} };
  }
  data.months[monthKey].entries[getEntryKey(employeeId, date)] = sanitizeEntry(entry);
  setToStorage(data);
};

const clearEntry = (monthKey: string, employeeId: string, date: string): void => {
  const data = getFromStorage();
  if (!data.months[monthKey]) return;
  delete data.months[monthKey].entries[getEntryKey(employeeId, date)];
  setToStorage(data);
};

const setMonthStatus = (monthKey: string, status: 'draft' | 'published'): void => {
  const data = getFromStorage();
  if (!data.months[monthKey]) {
    data.months[monthKey] = { status: 'draft', entries: {} };
  }
  data.months[monthKey].status = status;
  setToStorage(data);
};

const publishMonth = (monthKey: string, dates: string[], employeeIds: string[]): void => {
  const data = getFromStorage();
  if (!data.months[monthKey]) {
    data.months[monthKey] = { status: 'draft', entries: {} };
  }

  for (const employeeId of employeeIds) {
    for (const date of dates) {
      const key = getEntryKey(employeeId, date);
      if (!data.months[monthKey].entries[key]) {
        data.months[monthKey].entries[key] = { kind: 'SPECIAL', special: 'OFF' };
      }
    }
  }

  data.months[monthKey].status = 'published';
  setToStorage(data);
};

const getEmployeeByToken = (token: string): Employee | undefined => {
  const data = getFromStorage();
  return data.employees.find((employee) => employee.token === token && employee.active);
};

const getVisibleEntryForEmployee = (
  monthKey: string,
  employeeId: string,
  date: string
): ScheduleEntry | undefined => {
  const month = getMonth(monthKey);
  if (month.status !== 'published') return undefined;
  return month.entries[getEntryKey(employeeId, date)];
};

const getCellValue = (
  monthKey: string,
  employeeId: string,
  date: string
): { type: 'OBJECT'; value: string } | { type: 'SPECIAL'; value: SpecialValue } => {
  const month = getMonth(monthKey);
  const entry = month.entries[getEntryKey(employeeId, date)];
  if (!entry) return { type: 'SPECIAL', value: 'OFF' };
  if (entry.kind === 'OBJECT' && entry.object_id) return { type: 'OBJECT', value: entry.object_id };
  return { type: 'SPECIAL', value: entry.special ?? 'OFF' };
};

export const dataService = {
  getAppData: getFromStorage,
  setAppData: setToStorage,
  getMonth,
  upsertEmployee,
  upsertObject,
  setEntry,
  clearEntry,
  setMonthStatus,
  publishMonth,
  getCellValue,
  getEntryKey,
  getEmployeeByToken,
  getVisibleEntryForEmployee
};
