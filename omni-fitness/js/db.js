const DB_NAME = 'apexDB';
const DB_VERSION = 2;

let dbPromise = null;

function initDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            const oldVersion = event.oldVersion;

            // ── V1 Stores ────────────────────────────────────────
            if (oldVersion < 1) {
                db.createObjectStore('exerciseLibrary', { keyPath: 'id' });
                db.createObjectStore('customExercises', { keyPath: 'id' });
                db.createObjectStore('programFolders', { keyPath: 'id' });

                const ws = db.createObjectStore('workoutSessions', { keyPath: 'id' });
                ws.createIndex('date', 'startedAt', { unique: false });

                const wsets = db.createObjectStore('workoutSets', { keyPath: 'id' });
                wsets.createIndex('sessionId', 'sessionId', { unique: false });
                wsets.createIndex('exerciseId', 'exerciseId', { unique: false });

                const pr = db.createObjectStore('personalRecords', { keyPath: 'id' });
                pr.createIndex('exerciseId', 'exerciseId', { unique: true });

                db.createObjectStore('activeSession', { keyPath: 'id' });

                const ml = db.createObjectStore('muscleLoad', { keyPath: 'id' });
                ml.createIndex('weekKey', 'weekKey', { unique: false });
            } else {
                // Ensure legacy stores exist if migrating from v1
                if (!db.objectStoreNames.contains('exerciseLibrary')) db.createObjectStore('exerciseLibrary', { keyPath: 'id' });
                if (!db.objectStoreNames.contains('customExercises')) db.createObjectStore('customExercises', { keyPath: 'id' });
                if (!db.objectStoreNames.contains('programFolders')) db.createObjectStore('programFolders', { keyPath: 'id' });
                if (!db.objectStoreNames.contains('workoutSessions')) {
                    const ws = db.createObjectStore('workoutSessions', { keyPath: 'id' });
                    ws.createIndex('date', 'startedAt', { unique: false });
                }
                if (!db.objectStoreNames.contains('workoutSets')) {
                    const wsets = db.createObjectStore('workoutSets', { keyPath: 'id' });
                    wsets.createIndex('sessionId', 'sessionId', { unique: false });
                    wsets.createIndex('exerciseId', 'exerciseId', { unique: false });
                }
                if (!db.objectStoreNames.contains('personalRecords')) {
                    const pr = db.createObjectStore('personalRecords', { keyPath: 'id' });
                    pr.createIndex('exerciseId', 'exerciseId', { unique: true });
                }
                if (!db.objectStoreNames.contains('activeSession')) db.createObjectStore('activeSession', { keyPath: 'id' });
                if (!db.objectStoreNames.contains('muscleLoad')) {
                    const ml = db.createObjectStore('muscleLoad', { keyPath: 'id' });
                    ml.createIndex('weekKey', 'weekKey', { unique: false });
                }
            }

            // ── V2 Stores — Routines Planning Engine ────────────
            if (oldVersion < 2) {
                // Recreate routines stores with proper indexes (safe — no user data in these yet)
                if (db.objectStoreNames.contains('routines')) db.deleteObjectStore('routines');
                if (db.objectStoreNames.contains('routineBlocks')) db.deleteObjectStore('routineBlocks');
                if (db.objectStoreNames.contains('routineItems')) db.deleteObjectStore('routineItems');

                const routinesStore = db.createObjectStore('routines', { keyPath: 'id' });
                routinesStore.createIndex('programId', 'programId', { unique: false });
                routinesStore.createIndex('assignedDay', 'assignedDay', { unique: false });
                routinesStore.createIndex('order', 'order', { unique: false });

                const blocksStore = db.createObjectStore('routineBlocks', { keyPath: 'id' });
                blocksStore.createIndex('routineId', 'routineId', { unique: false });
                blocksStore.createIndex('order', 'order', { unique: false });

                const itemsStore = db.createObjectStore('routineItems', { keyPath: 'id' });
                itemsStore.createIndex('routineId', 'routineId', { unique: false });
                itemsStore.createIndex('blockId', 'blockId', { unique: false });
                itemsStore.createIndex('order', 'order', { unique: false });

                if (!db.objectStoreNames.contains('programs')) {
                    const programsStore = db.createObjectStore('programs', { keyPath: 'id' });
                    programsStore.createIndex('order', 'order', { unique: false });
                }

                if (!db.objectStoreNames.contains('routineTemplates')) {
                    db.createObjectStore('routineTemplates', { keyPath: 'id' });
                }
            }
        };

        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
    return dbPromise;
}

const apexDB = {
    async get(storeName, id) {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.get(id);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },
    async getAll(storeName) {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },
    async put(storeName, item) {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.put(item);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },
    async delete(storeName, id) {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.delete(id);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },
    async clear(storeName) {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    },
    async getByIndex(storeName, indexName, key) {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const index = store.index(indexName);
            const req = index.getAll(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },
    async putBatch(storeName, items) {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            items.forEach(item => store.put(item));
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },
    async deleteBatch(storeName, ids) {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            ids.forEach(id => store.delete(id));
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }
};

// Seed Exercise Library on first load
async function seedExercisesToDB() {
    const existing = await apexDB.getAll('exerciseLibrary');
    if (existing.length === 0) {
        if (typeof exerciseLibrary !== 'undefined') {
            for (const ex of exerciseLibrary) {
                await apexDB.put('exerciseLibrary', {
                    id: ex.id,
                    name: ex.name,
                    primaryMuscle: ex.muscle,
                    secondaryMuscle: '',
                    equipment: ex.equipment,
                    movementPattern: ex.pattern,
                    trackingType: 'Weight + Reps',
                    ...ex
                });
            }
        }
    }
}

// Global initialization
initDB().then(seedExercisesToDB).catch(console.error);
