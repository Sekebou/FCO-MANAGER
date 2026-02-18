/**
 * Firestore REST API utility for iOS Capacitor WebView
 * where the Firebase SDK hangs due to IndexedDB/persistence issues.
 * 
 * This module provides REST equivalents for all Firestore operations,
 * using the stored idToken from Firebase Auth REST login.
 */

const FIREBASE_API_KEY = 'AIzaSyAExtesWZPAEbQbGm5Rp17ek1PuWx_uceQ';
const PROJECT_ID = 'fco-manager-caccd';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// Platform detection
export const isIOSCapacitor = (() => {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isCap = !!(window as any).Capacitor;
  return isIOS && isCap;
})();

// ---------- Token Management ----------

let cachedIdToken: string | null = null;
let tokenExpiresAt = 0;

export const setIdToken = (token: string, expiresInSec = 3600) => {
  cachedIdToken = token;
  tokenExpiresAt = Date.now() + (expiresInSec - 60) * 1000; // refresh 60s early
};

const getIdToken = async (): Promise<string> => {
  if (cachedIdToken && Date.now() < tokenExpiresAt) return cachedIdToken;

  const refreshToken = localStorage.getItem('firebaseRefreshToken');
  if (!refreshToken) throw new Error('No refresh token available');

  const res = await fetch(
    `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
    }
  );
  if (!res.ok) throw new Error('Token refresh failed');
  const data = await res.json();
  if (data.refresh_token) localStorage.setItem('firebaseRefreshToken', data.refresh_token);
  cachedIdToken = data.id_token;
  tokenExpiresAt = Date.now() + (parseInt(data.expires_in || '3600') - 60) * 1000;
  return cachedIdToken!;
};

// ---------- Value Conversion ----------

const toFirestoreValue = (val: any): any => {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (val instanceof Date) return { timestampValue: val.toISOString() };
  if (typeof val === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
};

const fromFirestoreValue = (val: any): any => {
  if (!val) return null;
  if (val.stringValue !== undefined) return val.stringValue;
  if (val.booleanValue !== undefined) return val.booleanValue;
  if (val.integerValue !== undefined) return Number(val.integerValue);
  if (val.doubleValue !== undefined) return val.doubleValue;
  if (val.nullValue !== undefined) return null;
  if (val.timestampValue !== undefined) return val.timestampValue;
  if (val.arrayValue) {
    return (val.arrayValue.values || []).map(fromFirestoreValue);
  }
  if (val.mapValue) {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      result[k] = fromFirestoreValue(v);
    }
    return result;
  }
  return null;
};

const docToObject = (doc: any): any => {
  const fields = doc.fields || {};
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields)) {
    result[k] = fromFirestoreValue(v);
  }
  // Extract ID from document name
  const name: string = doc.name || '';
  const parts = name.split('/');
  result.id = parts[parts.length - 1];
  return result;
};

const dataToFields = (data: Record<string, any>): Record<string, any> => {
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) {
      fields[k] = toFirestoreValue(v);
    }
  }
  return fields;
};

// ---------- REST Operations ----------

export const restGetDoc = async (collectionPath: string, docId: string): Promise<any | null> => {
  const token = await getIdToken();
  const res = await fetch(`${BASE_URL}/${collectionPath}/${docId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET doc failed: ${res.status}`);
  const doc = await res.json();
  return docToObject(doc);
};

export const restGetCollection = async (
  collectionPath: string,
  options?: { orderBy?: string; direction?: 'ASCENDING' | 'DESCENDING' }
): Promise<any[]> => {
  const token = await getIdToken();

  // Use structured query for ordering
  if (options?.orderBy) {
    const body = {
      structuredQuery: {
        from: [{ collectionId: collectionPath.split('/').pop() }],
        orderBy: [{
          field: { fieldPath: options.orderBy },
          direction: options.direction || 'ASCENDING',
        }],
      },
    };

    // For subcollections, we need parent path
    const parts = collectionPath.split('/');
    let parentPath = BASE_URL;
    if (parts.length > 1) {
      parentPath = `${BASE_URL}/${parts.slice(0, -1).join('/')}`;
    }

    const res = await fetch(`${parentPath}:runQuery`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Query failed: ${res.status}`);
    const results = await res.json();
    return results
      .filter((r: any) => r.document)
      .map((r: any) => docToObject(r.document));
  }

  // Simple list
  const res = await fetch(`${BASE_URL}/${collectionPath}?pageSize=1000`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`GET collection failed: ${res.status}`);
  const data = await res.json();
  return (data.documents || []).map(docToObject);
};

export const restAddDoc = async (collectionPath: string, data: Record<string, any>): Promise<string> => {
  const token = await getIdToken();
  const res = await fetch(`${BASE_URL}/${collectionPath}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: dataToFields(data) }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Add doc failed: ${res.status} - ${errBody}`);
  }
  const doc = await res.json();
  const name: string = doc.name || '';
  return name.split('/').pop() || '';
};

export const restSetDoc = async (collectionPath: string, docId: string, data: Record<string, any>): Promise<void> => {
  const token = await getIdToken();
  const res = await fetch(`${BASE_URL}/${collectionPath}/${docId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: dataToFields(data) }),
  });
  if (!res.ok) throw new Error(`Set doc failed: ${res.status}`);
};

export const restUpdateDoc = async (collectionPath: string, docId: string, data: Record<string, any>): Promise<void> => {
  const token = await getIdToken();
  const fieldPaths = Object.keys(data).map(k => `updateMask.fieldPaths=${k}`).join('&');
  const res = await fetch(`${BASE_URL}/${collectionPath}/${docId}?${fieldPaths}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: dataToFields(data) }),
  });
  if (!res.ok) throw new Error(`Update doc failed: ${res.status}`);
};

export const restDeleteDoc = async (collectionPath: string, docId: string): Promise<void> => {
  const token = await getIdToken();
  const res = await fetch(`${BASE_URL}/${collectionPath}/${docId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Delete doc failed: ${res.status}`);
};

export const restQueryWhere = async (
  collectionPath: string,
  field: string,
  op: 'EQUAL' | 'ARRAY_CONTAINS',
  value: any
): Promise<any[]> => {
  const token = await getIdToken();
  const body = {
    structuredQuery: {
      from: [{ collectionId: collectionPath }],
      where: {
        fieldFilter: {
          field: { fieldPath: field },
          op,
          value: toFirestoreValue(value),
        },
      },
    },
  };
  const res = await fetch(`${BASE_URL}:runQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Query where failed: ${res.status}`);
  const results = await res.json();
  return results
    .filter((r: any) => r.document)
    .map((r: any) => docToObject(r.document));
};

// Array operations — REST doesn't support arrayUnion/arrayRemove natively,
// so we read-modify-write
export const restArrayUnion = async (collectionPath: string, docId: string, field: string, value: any): Promise<void> => {
  const doc = await restGetDoc(collectionPath, docId);
  if (!doc) throw new Error('Document not found');
  const arr: any[] = Array.isArray(doc[field]) ? [...doc[field]] : [];
  if (!arr.includes(value)) arr.push(value);
  await restUpdateDoc(collectionPath, docId, { [field]: arr });
};

export const restArrayRemove = async (collectionPath: string, docId: string, field: string, value: any): Promise<void> => {
  const doc = await restGetDoc(collectionPath, docId);
  if (!doc) throw new Error('Document not found');
  const arr: any[] = Array.isArray(doc[field]) ? doc[field].filter((v: any) => v !== value) : [];
  await restUpdateDoc(collectionPath, docId, { [field]: arr });
};

// Auth REST operations
export const restCreateUser = async (email: string, password: string): Promise<{ uid: string; email: string }> => {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  const data = await res.json();
  if (!res.ok) {
    const errMsg = data?.error?.message || '';
    if (errMsg.includes('EMAIL_EXISTS')) throw { code: 'auth/email-already-in-use', message: 'Ce nom d\'utilisateur existe déjà.' };
    throw new Error(errMsg || 'Account creation failed');
  }
  return { uid: data.localId, email: data.email };
};

export const restVerifyPassword = async (email: string, password: string): Promise<boolean> => {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: false }),
    }
  );
  return res.ok;
};

export const restSendPasswordReset = async (email: string): Promise<void> => {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestType: 'PASSWORD_RESET', email }),
    }
  );
  if (!res.ok) {
    const data = await res.json();
    const errMsg = data?.error?.message || '';
    if (errMsg.includes('EMAIL_NOT_FOUND')) throw { code: 'auth/user-not-found' };
    if (errMsg.includes('INVALID_EMAIL')) throw { code: 'auth/invalid-email' };
    throw new Error(errMsg);
  }
};

export const restChangePassword = async (newPassword: string): Promise<void> => {
  const token = await getIdToken();
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token, password: newPassword, returnSecureToken: true }),
    }
  );
  if (!res.ok) throw new Error('Password change failed');
  const data = await res.json();
  // Update tokens
  if (data.idToken) setIdToken(data.idToken, parseInt(data.expiresIn || '3600'));
  if (data.refreshToken) localStorage.setItem('firebaseRefreshToken', data.refreshToken);
};
