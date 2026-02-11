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
  fields?: Record<string, FirestoreValue>;
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

export const pullAppDataFromFirestore = async (projectId: string, apiKey: string): Promise<AppData | null> => {
  const response = await fetch(documentUrl(projectId, apiKey));
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Firestore pull failed: ${response.status}`);
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
    throw new Error(`Firestore push failed: ${response.status}`);
  }
};
