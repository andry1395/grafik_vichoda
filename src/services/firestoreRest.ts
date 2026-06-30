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

interface FirestoreV2Document<T> {
  id: string;
  payload: T;
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

const documentIdFromName = (name: string | undefined): string => {
  if (!name) return '';
  return decodeURIComponent(name.split('/').pop() ?? '');
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

export const pullAppDataFromFirestore = async (projectId: string, apiKey: string): Promise<AppData | null> => {
  const response = await fetch(documentUrl(projectId, apiKey));
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Firestore pull failed: ${await readFirestoreError(response)}`);
  }

  const data = (await response.json()) as FirestoreDocument;
  const raw = fromFirestoreValue(data.fields?.payload) as AppData | null;
  return raw;
};

export const pushAppDataToFirestore = async (projectId: string, apiKey: string, payload: AppData): Promise<void> => {
  const response = await fetch(documentUrl(projectId, apiKey), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        payload: toFirestoreValue(payload)
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Firestore push failed: ${await readFirestoreError(response)}`);
  }
};

const writeV2Document = async (projectId: string, apiKey: string, path: string[], payload: unknown): Promise<void> => {
  const response = await fetch(v2DocumentUrl(projectId, apiKey, path), {
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

const deleteV2Document = async (projectId: string, apiKey: string, path: string[]): Promise<void> => {
  const response = await fetch(v2DocumentUrl(projectId, apiKey, path), { method: 'DELETE' });
  if (response.status === 404) return;
  if (!response.ok) {
    throw new Error(`Firestore v2 delete failed: ${await readFirestoreError(response)}`);
  }
};

const readV2Document = async <T>(projectId: string, apiKey: string, path: string[]): Promise<T | null> => {
  const response = await fetch(v2DocumentUrl(projectId, apiKey, path));
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Firestore v2 read failed: ${await readFirestoreError(response)}`);
  }

  const data = (await response.json()) as FirestoreDocument;
  return fromFirestoreValue(data.fields?.payload) as T | null;
};

const listV2Documents = async <T>(projectId: string, apiKey: string, collectionPath: string[]): Promise<T[]> => {
  const documents = await listV2DocumentRefs<T>(projectId, apiKey, collectionPath);
  return documents.map((document) => document.payload);
};

const listV2DocumentRefs = async <T>(projectId: string, apiKey: string, collectionPath: string[]): Promise<Array<FirestoreV2Document<T>>> => {
  const refs: Array<FirestoreV2Document<T>> = [];
  let pageToken: string | undefined;

  do {
    const response = await fetch(v2CollectionUrl(projectId, apiKey, collectionPath, pageToken));
    if (response.status === 404) return refs;
    if (!response.ok) {
      throw new Error(`Firestore v2 list failed: ${await readFirestoreError(response)}`);
    }

    const data = (await response.json()) as FirestoreListResponse;
    for (const document of data.documents ?? []) {
      refs.push({
        id: documentIdFromName(document.name),
        payload: fromFirestoreValue(document.fields?.payload) as T
      });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return refs.filter((document) => document.id);
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

export const pullAppDataFromFirestoreV2 = async (projectId: string, apiKey: string): Promise<AppData | null> => {
  const status = await getFirestoreV2MigrationStatus(projectId, apiKey);
  if (!status.completed || !status.countsMatch) return null;

  const admins = await listV2Documents<AppData['admins'][number]>(projectId, apiKey, ['appAdmins']);
  const employees: AppData['employees'] = [];
  const objects: AppData['objects'] = [];
  const months: AppData['months'] = {};
  const plans: AppData['plans'] = {};
  const plan_ratio_defaults: AppData['plan_ratio_defaults'] = {};
  const vacation_requests: AppData['vacation_requests'] = [];

  for (const admin of admins) {
    employees.push(...(await listV2Documents<AppData['employees'][number]>(projectId, apiKey, ['appAdmins', admin.id, 'employees'])));
    objects.push(...(await listV2Documents<AppData['objects'][number]>(projectId, apiKey, ['appAdmins', admin.id, 'objects'])));
    vacation_requests.push(
      ...(await listV2Documents<AppData['vacation_requests'][number]>(projectId, apiKey, ['appAdmins', admin.id, 'vacations']))
    );

    const adminMonths = await listV2DocumentRefs<AppData['months'][string]>(projectId, apiKey, ['appAdmins', admin.id, 'months']);
    for (const month of adminMonths) {
      months[`${admin.id}__${month.id}`] = month.payload;
    }

    const adminPlans = await listV2DocumentRefs<AppData['plans'][string]>(projectId, apiKey, ['appAdmins', admin.id, 'plans']);
    for (const plan of adminPlans) {
      plans[`${admin.id}__${plan.id}`] = plan.payload;
    }

    const defaults = await readV2Document<AppData['plan_ratio_defaults'][string]>(projectId, apiKey, [
      'appAdmins',
      admin.id,
      'planRatioDefaults',
      'default'
    ]);
    if (defaults) {
      plan_ratio_defaults[admin.id] = defaults;
    }
  }

  return {
    admins,
    employees,
    objects,
    months,
    plans,
    plan_ratio_defaults,
    vacation_requests
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
  return syncAppDataToFirestoreV2(projectId, apiKey, data);
};

const deleteMissingDocuments = async (
  projectId: string,
  apiKey: string,
  collectionPath: string[],
  desiredIds: Set<string>
): Promise<void> => {
  const existing = await listV2DocumentRefs(projectId, apiKey, collectionPath);
  for (const document of existing) {
    if (!desiredIds.has(document.id)) {
      await deleteV2Document(projectId, apiKey, [...collectionPath, document.id]);
    }
  }
};

export const syncAppDataToFirestoreV2 = async (
  projectId: string,
  apiKey: string,
  data: AppData
): Promise<FirestoreV2MigrationStatus> => {
  const sourceCounts = countAppData(data);
  const fingerprint = sourceFingerprint(data);
  await writeV2Document(projectId, apiKey, ['appDataV2', 'meta'], {
    schema_version: 2,
    completed: false,
    migrated_at: new Date().toISOString(),
    source_fingerprint: fingerprint,
    source_counts: sourceCounts,
    v2_counts: null
  });

  const adminsById = new Map(data.admins.map((admin) => [admin.id, admin]));
  const desiredAdminIds = new Set(adminsById.keys());
  const existingAdmins = await listV2DocumentRefs<{ id: string }>(projectId, apiKey, ['appAdmins']);
  const allAdminIds = new Set([...desiredAdminIds, ...existingAdmins.map((admin) => admin.id)]);

  for (const admin of data.admins) {
    await writeV2Document(projectId, apiKey, ['appAdmins', admin.id], admin);
  }

  for (const adminId of allAdminIds) {
    const employees = data.employees.filter((employee) => employee.admin_id === adminId);
    const objects = data.objects.filter((objectItem) => objectItem.admin_id === adminId);
    const vacations = data.vacation_requests.filter((request) => request.admin_id === adminId);
    const monthsForAdmin = Object.entries(data.months).filter(([key]) => splitMonthStorageKey(key).adminId === adminId);
    const plansForAdmin = Object.entries(data.plans).filter(([key]) => splitPlanStorageKey(key).adminId === adminId);

    await deleteMissingDocuments(projectId, apiKey, ['appAdmins', adminId, 'employees'], new Set(employees.map((employee) => employee.id)));
    await deleteMissingDocuments(projectId, apiKey, ['appAdmins', adminId, 'objects'], new Set(objects.map((objectItem) => objectItem.id)));
    await deleteMissingDocuments(projectId, apiKey, ['appAdmins', adminId, 'vacations'], new Set(vacations.map((request) => request.id)));
    await deleteMissingDocuments(
      projectId,
      apiKey,
      ['appAdmins', adminId, 'months'],
      new Set(monthsForAdmin.map(([key]) => splitMonthStorageKey(key).monthKey))
    );
    await deleteMissingDocuments(
      projectId,
      apiKey,
      ['appAdmins', adminId, 'plans'],
      new Set(plansForAdmin.map(([key]) => {
        const { objectId, monthKey } = splitPlanStorageKey(key);
        return `${objectId}__${monthKey}`;
      }))
    );
    await deleteMissingDocuments(
      projectId,
      apiKey,
      ['appAdmins', adminId, 'planRatioDefaults'],
      new Set(data.plan_ratio_defaults[adminId] ? ['default'] : [])
    );

    for (const employee of employees) {
      await writeV2Document(projectId, apiKey, ['appAdmins', employee.admin_id, 'employees', employee.id], employee);
    }

    for (const objectItem of objects) {
      await writeV2Document(projectId, apiKey, ['appAdmins', objectItem.admin_id, 'objects', objectItem.id], objectItem);
    }

    for (const request of vacations) {
      await writeV2Document(projectId, apiKey, ['appAdmins', request.admin_id, 'vacations', request.id], request);
    }

    for (const [key, month] of monthsForAdmin) {
      const { monthKey } = splitMonthStorageKey(key);
      await writeV2Document(projectId, apiKey, ['appAdmins', adminId, 'months', monthKey], month);
    }

    for (const [key, plan] of plansForAdmin) {
      const { objectId, monthKey } = splitPlanStorageKey(key);
      await writeV2Document(projectId, apiKey, ['appAdmins', adminId, 'plans', `${objectId}__${monthKey}`], plan);
    }

    const defaults = data.plan_ratio_defaults[adminId];
    if (defaults) {
      await writeV2Document(projectId, apiKey, ['appAdmins', adminId, 'planRatioDefaults', 'default'], defaults);
    }

    if (!desiredAdminIds.has(adminId)) {
      await deleteV2Document(projectId, apiKey, ['appAdmins', adminId]);
    }
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
