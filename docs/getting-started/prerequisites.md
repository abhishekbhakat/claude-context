# Prerequisites

Before setting up Code Context, ensure you have the following requirements met.

## Required Services

### Embedding Provider (Choose One)

#### Option 1: OpenAI (Recommended)
- **API Key**: Get from [OpenAI Platform](https://platform.openai.com/api-keys)
- **Billing**: Active billing account required
- **Models**: `text-embedding-3-small` or `text-embedding-3-large`
- **Rate Limits**: Check current limits on your OpenAI account

#### Option 2: VoyageAI
- **API Key**: Get from [VoyageAI Console](https://dash.voyageai.com/)
- **Models**: `voyage-code-3` (optimized for code)
- **Billing**: Pay-per-use pricing

#### Option 3: Gemini
- **API Key**: Get from [Google AI Studio](https://aistudio.google.com/)
- **Models**: `gemini-embedding-001`
- **Quota**: Check current quotas and limits

#### Option 4: Ollama (Local)
- **Installation**: Download from [ollama.ai](https://ollama.ai/)
- **Models**: Pull embedding models like `nomic-embed-text`
- **Hardware**: Sufficient RAM for model loading (varies by model)

### Vector Database

#### LanceDB (Local-only)
- No account or API key required
- Set a writable path for the database with `LANCEDB_PATH` (e.g. `./.lancedb`)
- The database files will be created automatically at that path
- Optional: use Docker/local install of LanceDB if you prefer a server process

## Development Tools (Optional)

### For VSCode Extension
- **VSCode**: Version 1.74.0 or higher
- **Extensions**: Code Context extension from marketplace


### For Development Contributions
- **Git**: For version control
- **pnpm**: Package manager (preferred over npm)
- **TypeScript**: Understanding of TypeScript development
