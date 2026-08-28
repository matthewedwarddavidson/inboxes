// IndexedDB persistence layer (via idb), with a graceful in-memory fallback
// when IndexedDB is unavailable (e.g. some test/SSR environments).

import { openDB, type IDBPDatabase } from 'idb';
import type { GameRecord, SavedGame, Settings } from './types';

const DB_NAME = 'inboxes';
const DB_VERSION = 1;

const STORE_GAMES = 'games';
const STORE_SAVED = 'saved';
const STORE_SETTINGS = 'settings';

interface Schema {
  [STORE_GAMES]: GameRecord;
  [STORE_SAVED]: SavedGame;
  [STORE_SETTINGS]: Settings;
}

let dbPromise: Promise<IDBPDatabase<Schema>> | null = null;

function hasIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined';
}

function getDb(): Promise<IDBPDatabase<Schema>> {
  if (!dbPromise) {
    dbPromise = openDB<Schema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_GAMES)) {
          db.createObjectStore(STORE_GAMES, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_SAVED)) {
          db.createObjectStore(STORE_SAVED, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
          db.createObjectStore(STORE_SETTINGS, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

// --- In-memory fallback ---------------------------------------------------
const mem = {
  games: new Map<string, GameRecord>(),
  saved: new Map<string, SavedGame>(),
  settings: new Map<string, Settings>(),
};

// --- Games ----------------------------------------------------------------
export async function putGame(game: GameRecord): Promise<void> {
  if (!hasIndexedDB()) {
    mem.games.set(game.id, game);
    return;
  }
  const db = await getDb();
  await db.put(STORE_GAMES, game);
}

export async function getAllGames(): Promise<GameRecord[]> {
  if (!hasIndexedDB()) return [...mem.games.values()];
  const db = await getDb();
  return db.getAll(STORE_GAMES);
}

export async function clearGames(): Promise<void> {
  if (!hasIndexedDB()) {
    mem.games.clear();
    return;
  }
  const db = await getDb();
  await db.clear(STORE_GAMES);
}

// --- Saved (in-progress) game --------------------------------------------
export async function putSavedGame(saved: SavedGame): Promise<void> {
  if (!hasIndexedDB()) {
    mem.saved.set(saved.id, saved);
    return;
  }
  const db = await getDb();
  await db.put(STORE_SAVED, saved);
}

export async function getSavedGame(): Promise<SavedGame | undefined> {
  if (!hasIndexedDB()) return mem.saved.get('current');
  const db = await getDb();
  return db.get(STORE_SAVED, 'current');
}

export async function clearSavedGame(): Promise<void> {
  if (!hasIndexedDB()) {
    mem.saved.delete('current');
    return;
  }
  const db = await getDb();
  await db.delete(STORE_SAVED, 'current');
}

// --- Settings -------------------------------------------------------------
export async function getSettings(): Promise<Settings | undefined> {
  if (!hasIndexedDB()) return mem.settings.get('settings');
  const db = await getDb();
  return db.get(STORE_SETTINGS, 'settings');
}

export async function putSettings(settings: Settings): Promise<void> {
  if (!hasIndexedDB()) {
    mem.settings.set('settings', settings);
    return;
  }
  const db = await getDb();
  await db.put(STORE_SETTINGS, settings);
}
