# Metric Storage Normalization Plan

## Goal

Avoid data duplication by storing heavy metadata and embeddings for Movies, TV Shows, and Videos in a global `semantic_external_items` table. Implement **Bulk Async Enrichment** to cache entire batches of search results in the background.

## User Review Required

> [!IMPORTANT]
> **Bulk Async Workflow**:
>
> 1. User searches for "Matrix".
> 2. TMDB returns 20 results.
> 3. System immediately sends **all 20 candidates** as a SINGLE job to the `enrichmentQueue`.
> 4. Worker processes this batch: calculates embeddings for new items and bulk inserts them into `semantic_external_items`.
> 5. When User clicks "Save", the system links to the already-cached global item.

## Proposed Changes

### 1. Queue Infrastructure (`src/services/queue-service.ts`)

- **New Queue**: `enrichmentQueue` ('enrichment-processing').
- **Worker Logic**:
  - **Job Name**: `bulk-enrich-candidates`
  - **Payload**: `{ candidates: Array<ItemCandidate>, provider: 'tmdb' }`
  - **Process**:
    1. Extract all `externalIds` from payload.
    2. Query `semantic_external_items` to find existing ones.
    3. Filter out existing items.
    4. **Bulk Vectorize**: Generate embeddings for the new items (parallel promises).
    5. **Bulk Insert**: Insert all new items into `semantic_external_items` in one transaction.

### 2. Service Logic Updates

#### `src/services/enrichment/tmdb-service.ts`

- Modify `searchMovies` / `searchTVShows`:
  - Fetch results from TMDB.
  - **Dispatch Bulk Job**: `enrichmentQueue.add('bulk-enrich-candidates', { candidates: results })`.
  - Return results to UI immediately.

#### `src/services/item-service.ts`

- Modify `createItem`:
  1.  **Check Global**: Query `semantic_external_items` by `externalId`.
  2.  **Fallback**: If not found (job pending), create specific global item inline.
  3.  **Create User Memory**:
      - `embedding` = NULL.
      - `semanticExternalItemId` = Global Item ID.
      - `metadata` = Minimal JSON for UI.

### 3. Application Setup (`src/app.ts`)

- Register `enrichmentQueue` in Bull Board adapters.

## Verification Plan

1. **Search**: Search for a movie term.
2. **Monitor**: Check Bull Board for `bulk-enrich-candidates` job success.
3. **Database**: Verify `semantic_external_items` has new rows with vectors.
4. **Save**: Save a movie and verify `memory_items` links to it with NULL embedding.
