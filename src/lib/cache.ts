/**
 * IndexedDB Cache for Parquet Files
 *
 * Provides local browser storage for parquet files, similar to Redis but
 * running entirely client-side. Data persists across sessions.
 */

export const CACHE_DB_NAME = 'nfchat-cache'
export const CACHE_STORE_NAME = 'parquet-files'
export const CACHE_DB_VERSION = 1

export interface CachedFile {
  id: string
  data: ArrayBuffer
  filename: string
  size: number
  cachedAt: number
}

/**
 * ParquetCache - IndexedDB wrapper for caching parquet files
 */
export class ParquetCache {
  private dbPromise: Promise<IDBDatabase> | null = null

  private async getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(CACHE_DB_NAME, CACHE_DB_VERSION)

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'))
      }

      request.onsuccess = () => {
        resolve(request.result)
      }

      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(CACHE_STORE_NAME)) {
          db.createObjectStore(CACHE_STORE_NAME, { keyPath: 'id' })
        }
      }
    })

    return this.dbPromise
  }

  async get(id: string): Promise<CachedFile | null> {
    const db = await this.getDB()

    return new Promise((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE_NAME, 'readonly')
      const store = tx.objectStore(CACHE_STORE_NAME)
      const request = store.get(id)

      request.onsuccess = () => {
        resolve(request.result || null)
      }

      request.onerror = () => {
        reject(new Error('Failed to get cached file'))
      }
    })
  }

  async set(id: string, data: ArrayBuffer, filename: string, size: number): Promise<void> {
    const db = await this.getDB()

    return new Promise((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE_NAME, 'readwrite')
      const store = tx.objectStore(CACHE_STORE_NAME)

      const record: CachedFile = {
        id,
        data,
        filename,
        size,
        cachedAt: Date.now(),
      }

      const request = store.put(record)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(new Error('Failed to cache file'))
      }
    })
  }

  async delete(id: string): Promise<void> {
    const db = await this.getDB()

    return new Promise((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE_NAME, 'readwrite')
      const store = tx.objectStore(CACHE_STORE_NAME)
      const request = store.delete(id)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(new Error('Failed to delete cached file'))
      }
    })
  }

  async has(id: string): Promise<boolean> {
    const db = await this.getDB()

    return new Promise((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE_NAME, 'readonly')
      const store = tx.objectStore(CACHE_STORE_NAME)
      const request = store.count(IDBKeyRange.only(id))

      request.onsuccess = () => {
        resolve(request.result > 0)
      }

      request.onerror = () => {
        reject(new Error('Failed to check cache'))
      }
    })
  }
}

// Singleton instance
const cache = new ParquetCache()

/**
 * Get a cached file by ID
 */
export async function getCachedFile(id: string): Promise<CachedFile | null> {
  return cache.get(id)
}

/**
 * Store a file in cache
 */
export async function setCachedFile(
  id: string,
  data: ArrayBuffer,
  filename: string,
  size: number
): Promise<void> {
  return cache.set(id, data, filename, size)
}

/**
 * Delete a cached file
 */
export async function deleteCachedFile(id: string): Promise<void> {
  return cache.delete(id)
}

/**
 * Check if a file is cached
 */
export async function hasCachedFile(id: string): Promise<boolean> {
  return cache.has(id)
}
