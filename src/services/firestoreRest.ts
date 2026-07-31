import type { AppData } from '../types';

interface FirestoreValue {
  stringValue?: string;
  booleanValue?: boolean;
  integerValue?: string;
  doubleValue?: number;
  nullValue?: null;
  mapValue?: { fields?: Record<string, FirestoreValue> };
  arrayValue?: { values?: FirestoreValue[] };
}

interface FirestoreDocument {
  name?: string;
  fields?: Record<string, FirestoreValue>;
}

interface FirestoreListResponse {
  documents?: FirestoreDocument[];
  nextPageToken?: string;
}

export interface FirestoreV2Counts {
  admins: number;
  employees: number;
  objects: number;
  months: number;
  plans: number;
  planRatioDefaults: number;
  vacationRequests: number;
}

export interface FirestoreV2MigrationStatus {
  exists: boolean;
  completed: boolean;
  migratedAt: string | null;
  sourceFingerprint: string | null;
  sourceCounts: FirestoreV2Counts | null;
  v2Counts: FirestoreV2Counts | null;
  countsMatch: boolean;
}

const toFirestoreValue = (value: unknown): FirestoreValue => {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return { integerValue: String(value) };
    return { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map((item) => toFirestoreValue(item)) } };
  }
  if (typeof value === 'object') {
    const fields: Record<string, FirestoreValue> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      fields[key] = toFirestoreValue(child);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
};

const fromFirestoreValue = (value: FirestoreValue | undefined): unknown => {
  if (!value) return null;
  if ('stringValue' in value) return value.stringValue ?? '';
  if ('booleanValue' in value) return Boolean(value.booleanValue);
  if ('integerValue' in value) return Number(value.integerValue ?? 0);
  if ('doubleValue' in value) return Number(value.doubleValue ?? 0);
  if ('nullValue' in value) return null;
  if (value.arrayValue) return (value.arrayValue.values ?? []).map((item) => fromFirestoreValue(item));
  if (value.mapValue) {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value.mapValue.fields ?? {})) {
      result[key] = fromFirestoreValue(child);
    }
    return result;
  }
  return null;
};

const documentUrl = (projectId: string, apiKey: string): string =>
  `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/appData/main?key=${apiKey}`;

const firestoreBaseUrl = (projectId: string): string =>
  `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

const encodePath = (segments: string[]): string => segments.map((segment) => encodeURIComponent(segment)).join('/');

const v2DocumentUrl = (projectId: string, apiKey: string, path: string[]): string =>
  `${firestoreBaseUrl(projectId)}/${encodePath(path)}?key=${apiKey}`;

const v2CollectionUrl = (projectId: string, apiKey: string, path: string[], pageToken?: string): string => {
  const params = new URLSearchParams({ key: apiKey, pageSize: '1000' });
  if (pageToken) params.set('pageToken', pageToken);
  return `${firestoreBaseUrl(projectId)}/${encodePath(path)}?${params.toString()}`;
};

const FIRESTORE_REQUEST_TIMEOUT_MS = 20000;

const fetchWithTimeout = async (url: string, options?: RequestInit): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), FIRESTORE_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Firestore request timed out');
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
};


const readFirestoreError = async (response: Response): Promise<string> => {
  try {
    const data = (await response.json()) as { error?: { message?: string; status?: string } };
    const status = data.error?.status ? ` (${data.error.status})` : '';
    const message = data.error?.message ?? 'Unknown Firestore error';
    return `${response.status}${status}: ${message}`;
  } catch {
    return String(response.status);
  }
};

const parseAppDataPayload = (value: FirestoreValue | undefined): AppData | null => {
  const raw = fromFirestoreValue(value);
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as AppData;
    } catch {
      throw new Error('Firestore pull failed: appData payload JSON is invalid');
    }
  }
  return raw as AppData | null;
};

export const pullAppDataFromFirestore = async (projectId: string, apiKey: string): Promise<AppData | null> => {
  const response = await fetchWithTimeout(documentUrl(projectId, apiKey));
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Firestore pull failed: ${await readFirestoreError(response)}`);
  }

  const data = (await response.json()) as FirestoreDocument;
  return parseAppDataPayload(data.fields?.payload);
};

export const pushAppDataToFirestore = async (projectId: string, apiKey: string, payload: AppData): Promise<void> => {
  const response = await fetchWithTimeout(documentUrl(projectId, apiKey), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        payload: { stringValue: JSON.stringify(payload) }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Firestore push failed: ${await readFirestoreError(response)}`);
  }
};

const writeV2Document = async (projectId: string, apiKey: string, path: string[], payload: unknown): Promise<void> => {
  const response = await fetchWithTimeout(v2DocumentUrl(projectId, apiKey, path), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        payload: toFirestoreValue(payload)
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Firestore v2 write failed: ${await readFirestoreError(response)}`);
  }
};

const readV2Document = async <T>(projectId: string, apiKey: string, path: string[]): Promise<T | null> => {
  const response = await fetchWithTimeout(v2DocumentUrl(projectId, apiKey, path));
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Firestore v2 read failed: ${await readFirestoreError(response)}`);
  }

  const data = (await response.json()) as FirestoreDocument;
  return fromFirestoreValue(data.fields?.payload) as T | null;
};

const listV2Documents = async <T>(projectId: string, apiKey: string, collectionPath: string[]): Promise<T[]> => {
  const result: T[] = [];
  let pageToken: string | undefined;

  do {
    const response = await fetchWithTimeout(v2CollectionUrl(projectId, apiKey, collectionPath, pageToken));
    if (response.status === 404) return result;
    if (!response.ok) {
      throw new Error(`Firestore v2 list failed: ${await readFirestoreError(response)}`);
    }

    const data = (await response.json()) as FirestoreListResponse;
    for (const document of data.documents ?? []) {
      result.push(fromFirestoreValue(document.fields?.payload) as T);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return result;
};

const countAppData = (data: AppData): FirestoreV2Counts => ({
  admins: data.admins.length,
  employees: data.employees.length,
  objects: data.objects.length,
  months: Object.keys(data.months).length,
  plans: Object.keys(data.plans).length,
  planRatioDefaults: Object.keys(data.plan_ratio_defaults).length,
  vacationRequests: data.vacation_requests.length
});

const countsEqual = (left: FirestoreV2Counts | null, right: FirestoreV2Counts | null): boolean =>
  Boolean(
    left &&
      right &&
      left.admins === right.admins &&
      left.employees === right.employees &&
      left.objects === right.objects &&
      left.months === right.months &&
      left.plans === right.plans &&
      left.planRatioDefaults === right.planRatioDefaults &&
      left.vacationRequests === right.vacationRequests
  );

const sourceFingerprint = (data: AppData): string => JSON.stringify(data);

const splitMonthStorageKey = (key: string): { adminId: string; monthKey: string } => {
  const [adminId, ...monthParts] = key.split('__');
  return { adminId: adminId || 'super-admin', monthKey: monthParts.join('__') || key };
};

const splitPlanStorageKey = (key: string): { adminId: string; objectId: string; monthKey: string } => {
  const [adminId, objectId, ...monthParts] = key.split('__');
  return {
    adminId: adminId || 'super-admin',
    objectId: objectId || 'unknown-object',
    monthKey: monthParts.join('__') || 'unknown-month'
  };
};

export const getFirestoreV2Counts = async (projectId: string, apiKey: string): Promise<FirestoreV2Counts> => {
  const admins = await listV2Documents<{ id: string }>(projectId, apiKey, ['appAdmins']);
  let employees = 0;
  let objects = 0;
  let months = 0;
  let plans = 0;
  let planRatioDefaults = 0;
  let vacationRequests = 0;

  for (const admin of admins) {
    employees += (await listV2Documents(projectId, apiKey, ['appAdmins', admin.id, 'employees'])).length;
    objects += (await listV2Documents(projectId, apiKey, ['appAdmins', admin.id, 'objects'])).length;
    months += (await listV2Documents(projectId, apiKey, ['appAdmins', admin.id, 'months'])).length;
    plans += (await listV2Documents(projectId, apiKey, ['appAdmins', admin.id, 'plans'])).length;
    planRatioDefaults += (await listV2Documents(projectId, apiKey, ['appAdmins', admin.id, 'planRatioDefaults'])).length;
    vacationRequests += (await listV2Documents(projectId, apiKey, ['appAdmins', admin.id, 'vacations'])).length;
  }

  return {
    admins: admins.length,
    employees,
    objects,
    months,
    plans,
    planRatioDefaults,
    vacationRequests
  };
};

export const getFirestoreV2MigrationStatus = async (projectId: string, apiKey: string): Promise<FirestoreV2MigrationStatus> => {
  const meta = await readV2Document<{
    completed?: boolean;
    migrated_at?: string;
    source_fingerprint?: string;
    source_counts?: FirestoreV2Counts;
    v2_counts?: FirestoreV2Counts;
  }>(projectId, apiKey, ['appDataV2', 'meta']);

  if (!meta) {
    return {
      exists: false,
      completed: false,
      migratedAt: null,
      sourceFingerprint: null,
      sourceCounts: null,
      v2Counts: null,
      countsMatch: false
    };
  }

  return {
    exists: true,
    completed: meta.completed === true,
    migratedAt: meta.migrated_at ?? null,
    sourceFingerprint: meta.source_fingerprint ?? null,
    sourceCounts: meta.source_counts ?? null,
    v2Counts: meta.v2_counts ?? null,
    countsMatch: countsEqual(meta.source_counts ?? null, meta.v2_counts ?? null)
  };
};

export const migrateAppDataToFirestoreV2 = async (
  projectId: string,
  apiKey: string,
  data: AppData
): Promise<FirestoreV2MigrationStatus> => {
  const sourceCounts = countAppData(data);
  const fingerprint = sourceFingerprint(data);

  for (const admin of data.admins) {
    await writeV2Document(projectId, apiKey, ['appAdmins', admin.id], admin);
  }

  for (const employee of data.employees) {
    await writeV2Document(projectId, apiKey, ['appAdmins', employee.admin_id, 'employees', employee.id], employee);
  }

  for (const objectItem of data.objects) {
    await writeV2Document(projectId, apiKey, ['appAdmins', objectItem.admin_id, 'objects', objectItem.id], objectItem);
  }

  for (const [key, month] of Object.entries(data.months)) {
    const { adminId, monthKey } = splitMonthStorageKey(key);
    await writeV2Document(projectId, apiKey, ['appAdmins', adminId, 'months', monthKey], month);
  }

  for (const [adminId, defaults] of Object.entries(data.plan_ratio_defaults)) {
    await writeV2Document(projectId, apiKey, ['appAdmins', adminId, 'planRatioDefaults', 'default'], defaults);
  }

  for (const [key, plan] of Object.entries(data.plans)) {
    const { adminId, objectId, monthKey } = splitPlanStorageKey(key);
    await writeV2Document(projectId, apiKey, ['appAdmins', adminId, 'plans', `${objectId}__${monthKey}`], plan);
  }

  for (const request of data.vacation_requests) {
    await writeV2Document(projectId, apiKey, ['appAdmins', request.admin_id, 'vacations', request.id], request);
  }

  const v2Counts = await getFirestoreV2Counts(projectId, apiKey);
  const completed = countsEqual(sourceCounts, v2Counts);
  const migratedAt = new Date().toISOString();

  await writeV2Document(projectId, apiKey, ['appDataV2', 'meta'], {
    schema_version: 2,
    completed,
    migrated_at: migratedAt,
    source_fingerprint: fingerprint,
    source_counts: sourceCounts,
    v2_counts: v2Counts
  });

  return {
    exists: true,
    completed,
    migratedAt,
    sourceFingerprint: fingerprint,
    sourceCounts,
    v2Counts,
    countsMatch: completed
  };
};
