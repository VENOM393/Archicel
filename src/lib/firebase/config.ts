/**
 * Arranque de Firebase.
 *
 * Los valores salen de `.env.local` (prefijo NEXT_PUBLIC_, así que viajan al navegador:
 * es lo normal y lo esperado — lo que protege los datos son las reglas de firestore.rules).
 *
 * Todo es perezoso: si falta configuración, la app sigue funcionando contra el almacén
 * local en vez de romperse. Eso permite trabajar sin red y hacer pruebas sin tocar la nube.
 */

import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const hayFirebase = Boolean(config.apiKey && config.projectId);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

function arrancar(): FirebaseApp | null {
  if (!hayFirebase) return null;
  if (!app) app = getApps()[0] ?? initializeApp(config as Required<typeof config>);
  return app;
}

export function getAuthCliente(): Auth | null {
  const a = arrancar();
  if (!a) return null;
  if (!auth) auth = getAuth(a);
  return auth;
}

export function getDb(): Firestore | null {
  const a = arrancar();
  if (!a) return null;
  if (!db) db = getFirestore(a);
  return db;
}

export const PROYECTO = config.projectId ?? '(sin configurar)';
