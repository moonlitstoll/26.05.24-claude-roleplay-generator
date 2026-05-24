import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'roleplay-gen-db';
const STORE_NAME = 'sessions';

export interface SavedSession {
    id: string;
    timestamp: Date;
    input: string;
    language: string;
    sets: import('../types').GeneratedSet[];
    audioBlob: Blob | null;
    audioMap?: { [key: number]: Blob };
    audioBlobSouth?: Blob | null;
    audioMapSouth?: { [key: number]: Blob };
    offsets?: number[];
    offsetsSouth?: number[];
    lastAccent?: 'north' | 'south';
}

// Singleton DB instance
let dbInstance: IDBPDatabase | null = null;

const getDB = async (): Promise<IDBPDatabase> => {
    if (dbInstance) return dbInstance;
    dbInstance = await openDB(DB_NAME, 1, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        },
    });
    return dbInstance;
};

export const saveSession = async (session: SavedSession) => {
    try {
        const db = await getDB();
        await db.put(STORE_NAME, session);
    } catch (e) {
        console.error('[Storage] Failed to save session:', e);
    }
};

export const getSessions = async (): Promise<SavedSession[]> => {
    try {
        const db = await getDB();
        return db.getAll(STORE_NAME);
    } catch (e) {
        console.error('[Storage] Failed to get sessions:', e);
        return [];
    }
};

export const deleteSession = async (id: string) => {
    try {
        const db = await getDB();
        await db.delete(STORE_NAME, id);
    } catch (e) {
        console.error('[Storage] Failed to delete session:', e);
    }
};

export const clearSessions = async () => {
    try {
        const db = await getDB();
        await db.clear(STORE_NAME);
    } catch (e) {
        console.error('[Storage] Failed to clear sessions:', e);
    }
};
