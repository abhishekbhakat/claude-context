// Re-export types and interfaces
export {
    VectorDocument,
    SearchOptions,
    VectorSearchResult,
    VectorDatabase,
    HybridSearchRequest,
    HybridSearchOptions,
    HybridSearchResult,
    RerankStrategy
} from './types';

// Implementation class exports
export { LanceVectorDatabase, LanceConfig } from './lancedb-vectordb';