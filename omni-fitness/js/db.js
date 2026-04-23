const DB_NAME = 'apexDB';
const DB_VERSION = 1;

let dbPromise = null;

function initDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            if (!db.objectStoreNames.contains('exerciseLibrary')) db.createObjectStore('exerciseLibrary', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('customExercises')) db.createObjectStore('customExercises', { keyPath: 'id' });
            
            if (!db.objectStoreNames.contains('programFolders')) db.createObjectStore('programFolders', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('routines')) db.createObjectStore('routines', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('routineBlocks')) db.createObjectStore('routineBlocks', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('routineItems')) db.createObjectStore('routineItems', { keyPath: 'id' });
            
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
            if (!db.objectStoreNames.contains('activeSession')) {
                db.createObjectStore('activeSession', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('muscleLoad')) {
                const ml = db.createObjectStore('muscleLoad', { keyPath: 'id' });
                ml.createIndex('weekKey', 'weekKey', { unique: false });
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
    }
};

// Seed Exercise Library on first load
async function seedExercisesToDB() {
    const existing = await apexDB.getAll('exerciseLibrary');
    if (existing.length === 0) {
        // Assume exerciseLibrary array is globally available from data.js
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
