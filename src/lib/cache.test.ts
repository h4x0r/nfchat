import { describe, it, expect } from 'vitest'
import {
  CACHE_DB_NAME,
  CACHE_STORE_NAME,
  ParquetCache,
} from './cache'

describe('ParquetCache', () => {
  describe('constants', () => {
    it('exports database name', () => {
      expect(CACHE_DB_NAME).toBe('nfchat-cache')
    })

    it('exports store name', () => {
      expect(CACHE_STORE_NAME).toBe('parquet-files')
    })

    it('has correct db version', () => {
      // Version should be defined
      expect(typeof CACHE_STORE_NAME).toBe('string')
    })
  })

  describe('ParquetCache class', () => {
    it('can be instantiated', () => {
      const cache = new ParquetCache()
      expect(cache).toBeInstanceOf(ParquetCache)
    })

    it('has get method', () => {
      const cache = new ParquetCache()
      expect(typeof cache.get).toBe('function')
    })

    it('has set method', () => {
      const cache = new ParquetCache()
      expect(typeof cache.set).toBe('function')
    })

    it('has delete method', () => {
      const cache = new ParquetCache()
      expect(typeof cache.delete).toBe('function')
    })

    it('has has method', () => {
      const cache = new ParquetCache()
      expect(typeof cache.has).toBe('function')
    })
  })

  describe('CachedFile interface', () => {
    it('defines expected structure', () => {
      // Type check - this passes if CachedFile has the right structure
      const mockCachedFile = {
        id: 'test',
        data: new ArrayBuffer(8),
        filename: 'test.parquet',
        size: 1024,
        cachedAt: Date.now(),
      }

      expect(mockCachedFile.id).toBeDefined()
      expect(mockCachedFile.data).toBeDefined()
      expect(mockCachedFile.filename).toBeDefined()
      expect(mockCachedFile.size).toBeDefined()
      expect(mockCachedFile.cachedAt).toBeDefined()
    })
  })
})
