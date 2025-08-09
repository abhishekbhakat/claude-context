# Basic Usage Example

This example demonstrates the basic usage of Code Context.

## Prerequisites

1. **OpenAI API Key**: Set your OpenAI API key for embeddings:
   ```bash
   export OPENAI_API_KEY="your-openai-api-key"
   ```

2. **LanceDB Server**: Make sure LanceDB server is running:
    In this case, set the `LANCEDB_PATH` as the Path and `LANCEDB_PATH` as the Token like this:
    ```bash
    export LANCEDB_PATH="https://your-cluster.lancedbcloud.com"
    export LANCEDB_PATH="your-lancedb-token"
    ```


- You can also set up a LanceDB server on [Docker or Kubernetes](https://LanceDB.io/docs/install-overview.md). In this setup, please use the server address and port as your `uri`, e.g.`http://localhost:19530`. If you enable the authentication feature on LanceDB, set the `token` as `"<your_username>:<your_password>"`, otherwise there is no need to set the token.
    ```bash
    export LANCEDB_PATH="http://localhost:19530"
    export LANCEDB_PATH="<your_username>:<your_password>"
    ```


## Running the Example

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Set environment variables (see examples above)

3. Run the example:
   ```bash
   pnpm run start
   ```

## What This Example Does
1. **Indexes Codebase**: Indexes the entire Code Context project
2. **Performs Searches**: Executes semantic searches for different code patterns
3. **Shows Results**: Displays search results with similarity scores and file locations

## Expected Output

```
🚀 Code Context Real Usage Example
===============================
...
🔌 Connecting to vector database at: ...

📖 Starting to index codebase...
🗑️  Existing index found, clearing it first...
📊 Indexing stats: 45 files, 234 code chunks

🔍 Performing semantic search...

🔎 Search: "vector database operations"
   1. Similarity: 89.23%
      File: /path/to/packages/core/src/vectordb/LanceDB-vectordb.ts
      Language: typescript
      Lines: 147-177
      Preview: async search(collectionName: string, queryVector: number[], options?: SearchOptions)...

🎉 Example completed successfully!
```
