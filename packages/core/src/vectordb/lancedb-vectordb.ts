import * as path from 'path';
import * as fs from 'fs';

import {
  VectorDatabase,
  VectorDocument,
  VectorSearchResult,
  SearchOptions,
  HybridSearchRequest,
  HybridSearchOptions,
  HybridSearchResult,
} from './types';

export interface LanceConfig {
  /** Filesystem directory to store LanceDB tables */
  dbPath: string;
}

/**
 * LanceDB-backed VectorDatabase implementation.
 *
 * Notes:
 * - Uses dynamic imports and 'any' to avoid tight coupling to LanceDB typings.
 * - Hybrid search is implemented as dense-only initially; BM25 fusion can be added later.
 */
export class LanceVectorDatabase implements VectorDatabase {
  private config: LanceConfig;
  private db: any | null = null;
  private lancedb: any | null = null;

  constructor(config: LanceConfig) {
    this.config = config;
  }

  private async ensureClient(): Promise<void> {
    if (this.db) return;
    if (!this.lancedb) {
      // Lazy-load LanceDB
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      this.lancedb = await import('@lancedb/lancedb').catch(() => null);
      if (!this.lancedb) {
        throw new Error('Failed to load @lancedb/lancedb. Ensure it is installed.');
      }
    }
    // Ensure folder exists
    fs.mkdirSync(this.config.dbPath, { recursive: true });
    this.db = await this.lancedb.connect(this.config.dbPath);
  }

  private async openOrCreateTable(collectionName: string, initialRows?: any[]): Promise<any> {
    await this.ensureClient();
    try {
      return await this.db.openTable(collectionName);
    } catch (e) {
      const rows = Array.isArray(initialRows) ? initialRows : [];
      return await this.db.createTable(collectionName, rows);
    }
  }

  private getTablePath(collectionName: string): string {
    return path.join(this.config.dbPath, collectionName);
  }

  async createCollection(collectionName: string, dimension: number, description?: string): Promise<void> { // eslint-disable-line @typescript-eslint/no-unused-vars
    // Create an empty table if it does not exist yet. We defer schema inference to first insert.
    await this.openOrCreateTable(collectionName, []);
  }

  async createHybridCollection(collectionName: string, dimension: number, description?: string): Promise<void> { // eslint-disable-line @typescript-eslint/no-unused-vars
    // Create table and attempt to create FTS index on content
    const table = await this.openOrCreateTable(collectionName, []);
    try {
      if (typeof table.createIndex === 'function') {
        // Try common FTS index creation signatures
        try {
          await table.createIndex('content', { config: this.lancedb.Index.fts() });
        } catch {
          try {
            await table.createIndex('content', this.lancedb.Index.fts());
          } catch {
            await table.createIndex('content', { type: 'fts' });
          }
        }
      }
    } catch {
      // ignore index creation failure, hybrid will still fall back to dense
    }
  }

  async dropCollection(collectionName: string): Promise<void> {
    await this.ensureClient();
    // Try official API; fallback to removing directory if necessary
    if (this.db && typeof this.db.dropTable === 'function') {
      try {
        await this.db.dropTable(collectionName);
        return;
      } catch {
        // fall through to filesystem cleanup
      }
    }
    const tableDir = this.getTablePath(collectionName);
    if (fs.existsSync(tableDir)) {
      fs.rmSync(tableDir, { recursive: true, force: true });
    }
  }

  async hasCollection(collectionName: string): Promise<boolean> {
    await this.ensureClient();
    // Prefer API if available
    if (this.db && typeof this.db.tableNames === 'function') {
      try {
        const names: string[] = await this.db.tableNames();
        return names.includes(collectionName);
      } catch {
        // fallback to fs
      }
    }
    return fs.existsSync(this.getTablePath(collectionName));
  }

  async listCollections(): Promise<string[]> {
    await this.ensureClient();
    if (this.db && typeof this.db.tableNames === 'function') {
      try {
        const names: string[] = await this.db.tableNames();
        return Array.isArray(names) ? names : [];
      } catch {
        // fallback
      }
    }
    try {
      const entries = fs.readdirSync(this.config.dbPath, { withFileTypes: true });
      return entries.filter(e => e.isDirectory()).map(e => e.name);
    } catch {
      return [];
    }
  }

  private toRow(doc: VectorDocument) {
    return {
      id: doc.id,
      vector: doc.vector,
      content: doc.content,
      relativePath: doc.relativePath,
      startLine: doc.startLine,
      endLine: doc.endLine,
      fileExtension: doc.fileExtension,
      metadata: JSON.stringify(doc.metadata ?? {}),
    };
  }

  private fromRow(row: any, score: number, fallbackVector: number[]): VectorSearchResult {
    let metadata: Record<string, any> = {};
    try {
      metadata = row.metadata ? JSON.parse(row.metadata) : {};
    } catch {
      metadata = {};
    }
    return {
      document: {
        id: row.id,
        vector: fallbackVector,
        content: row.content,
        relativePath: row.relativePath,
        startLine: row.startLine,
        endLine: row.endLine,
        fileExtension: row.fileExtension,
        metadata,
      },
      score: typeof row.score === 'number' ? row.score : score,
    };
  }

  async insert(collectionName: string, documents: VectorDocument[]): Promise<void> {
    if (!documents || documents.length === 0) return;
    const rows = documents.map(d => this.toRow(d));
    const table = await this.openOrCreateTable(collectionName, rows);
    if (typeof table.add === 'function' && rows.length > 0) {
      await table.add(rows);
    }
  }

  async insertHybrid(collectionName: string, documents: VectorDocument[]): Promise<void> {
    // For LanceDB we store the same schema; content will be used for FTS when available.
    await this.insert(collectionName, documents);
  }

  async search(collectionName: string, queryVector: number[], options?: SearchOptions): Promise<VectorSearchResult[]> {
    const table = await this.openOrCreateTable(collectionName, []);
    const topK = options?.topK ?? 10;
    // Dense vector search
    let results: any[] = [];
    try {
      const q = table.search(queryVector);
      const arr = await q.limit(topK).toArray();
      results = Array.isArray(arr) ? arr : [];
    } catch {
      results = [];
    }
    return results.map((r: any) => this.fromRow(r, 0, queryVector));
  }

  async hybridSearch(collectionName: string, searchRequests: HybridSearchRequest[], options?: HybridSearchOptions): Promise<HybridSearchResult[]> {
    const table = await this.openOrCreateTable(collectionName, []);
    const topK = options?.limit ?? (searchRequests[0]?.limit || 10);
    const denseReq = searchRequests.find(r => Array.isArray(r.data));
    const textReq = searchRequests.find(r => typeof r.data === 'string');
    const vector = denseReq && Array.isArray(denseReq.data) ? (denseReq.data as number[]) : [];
    const text = (textReq && typeof textReq.data === 'string') ? (textReq.data as string) : '';

    // Try LanceDB hybrid search variants; fall back to dense-only if not supported
    let results: any[] = [];
    try {
      if (typeof table.search === 'function') {
        // Variant A: single-arg object
        try {
          const arr = await table.search({ vector, text, queryType: 'hybrid' }).limit(topK).toArray();
          results = Array.isArray(arr) ? arr : [];
        } catch {
          // Variant B: chain methods
          try {
            const arr = await table.search(vector).text?.(text)?.hybrid?.()?.limit(topK).toArray();
            results = Array.isArray(arr) ? arr : [];
          } catch {
            // Variant C: dense only
            const arr = await table.search(vector).limit(topK).toArray();
            results = Array.isArray(arr) ? arr : [];
          }
        }
      }
    } catch {
      // last resort: dense only via our search()
      const dense = await this.search(collectionName, vector, { topK });
      return dense.map(r => ({ document: r.document, score: r.score }));
    }

    return results.map((r: any) => ({
      document: this.fromRow(r, 0, vector).document,
      score: typeof r.score === 'number' ? r.score : 0,
    }));
  }

  async delete(collectionName: string, ids: string[]): Promise<void> {
    if (!ids || ids.length === 0) return;
    const table = await this.openOrCreateTable(collectionName, []);
    // Try native delete with filter if available; else rewrite table
    if (typeof table.delete === 'function') {
      try {
        // LanceDB JS delete usually accepts a predicate string; we fallback if not supported
        await table.delete((row: any) => ids.includes(row.id));
        return;
      } catch {
        // fallback below
      }
    }
    const all: any[] = await table.search().limit(1000000).toArray();
    const remaining = all.filter(r => !ids.includes(r.id));
    await this.dropCollection(collectionName);
    await this.openOrCreateTable(collectionName, remaining);
  }

  async query(collectionName: string, filter: string, outputFields: string[], limit?: number): Promise<Record<string, any>[]> {
    const table = await this.openOrCreateTable(collectionName, []);
    const max = limit ?? 16384;
    // Basic filter support for pattern: relativePath == "..."
    let rows: any[] = [];
    try {
      rows = await table.search().limit(max).toArray();
    } catch {
      rows = [];
    }
    const m = filter && filter.match(/^\s*relativePath\s*==\s*"(.+)"\s*$/);
    if (m) {
      const wanted = m[1];
      rows = rows.filter(r => r.relativePath === wanted);
    }
    // Project fields
    return rows.slice(0, max).map(r => {
      const out: Record<string, any> = {};
      for (const f of outputFields) {
        out[f] = r[f];
      }
      return out;
    });
  }
}


