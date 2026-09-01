import { getApp, getApps, initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore, initializeFirestore } from "firebase/firestore"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

const missingEnvKeys = [] as string[];
if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) missingEnvKeys.push("NEXT_PUBLIC_FIREBASE_API_KEY");
if (!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) missingEnvKeys.push("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) missingEnvKeys.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
if (!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) missingEnvKeys.push("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");
if (!process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID) missingEnvKeys.push("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID");
if (!process.env.NEXT_PUBLIC_FIREBASE_APP_ID) missingEnvKeys.push("NEXT_PUBLIC_FIREBASE_APP_ID");

if (missingEnvKeys.length > 0) {
  throw new Error(`Configuracao do Firebase ausente. Defina no .env.local: ${missingEnvKeys.join(", ")}`)
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()

export const auth = getAuth(app)

/**
 * ignoreUndefinedProperties: sem isto o Firestore recusa gravar o documento
 * INTEIRO quando um campo vai a undefined, com "Unsupported field value:
 * undefined". Era o que rebentava ao criar uma revisao, que limpa a dataEmissao.
 * Com a opcao ligada o campo e simplesmente omitido no documento.
 */
export const db = (() => {
  try {
    return initializeFirestore(app, { ignoreUndefinedProperties: true })
  } catch {
    // Ja tinha sido inicializado (recarregamento a quente em desenvolvimento)
    return getFirestore(app)
  }
})()

export default app
