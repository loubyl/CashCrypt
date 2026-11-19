// Opening helpers for the crypt database. Browser-only singleton, injectable for tests.
import { CRYPT_DB_NAME, CryptDb, DEMO_DB_NAME } from "@/lib/db/schema";

export type OpenCryptOptions = {
  indexedDB: IDBFactory;
  IDBKeyRange: typeof IDBKeyRange;
};

/** Creates a CryptDb. Pass fake-indexeddb implementations in tests. */
export function openCrypt(name: string, opts?: OpenCryptOptions): CryptDb {
  return new CryptDb(name, opts);
}

const singletons = new Map<string, CryptDb>();

/** Returns the shared CryptDb for a name. Throws outside the browser. */
export function getCryptDb(name: string): CryptDb {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is not available in this environment.");
  }
  let db = singletons.get(name);
  if (!db) {
    db = openCrypt(name);
    singletons.set(name, db);
  }
  return db;
}

export function assertDemoDb(db: CryptDb): void {
  if (db.name !== DEMO_DB_NAME) {
    throw new Error(`Expected the demo database, got "${db.name}".`);
  }
}

export function assertRealDb(db: CryptDb): void {
  if (db.name !== CRYPT_DB_NAME) {
    throw new Error(`Expected the real database, got "${db.name}".`);
  }
}
