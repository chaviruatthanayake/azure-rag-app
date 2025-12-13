#  RAG Application - GCP Edition

A production-ready Retrieval-Augmented Generation (RAG) application that syncs documents from Google Drive, indexes them in a vector database, and provides intelligent question-answering with web search fallback.

##  Overview

This RAG application automatically processes documents from Google Drive, creates vector embeddings, stores them in Cloud SQL with pgvector, and enables multi-language question-answering powered by Google's Gemini AI.

### Key Features

- ✅ **Automatic Document Sync** - Monitors Google Drive folder and auto-indexes new documents
- ✅ **Multi-Format Support** - PDF, DOCX, XLSX, images, videos
- ✅ **Web Search Fallback** - Searches the internet when answer not in documents, then saves to knowledge base
- ✅ **Multi-Language Support** - Auto-detects questions in 100+ languages, translates, and responds
- ✅ **Concise Responses** - Bullet-point format for quick comprehension
- ✅ **Production-Ready** - Runs on Kubernetes with auto-scaling and health checks

---

##  Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interface                          │
│                    (Web Browser / API Client)                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    RAG Application (Node.js)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐  │
│  │   Document   │  │   Question   │  │    Translation      │  │
│  │  Processing  │  │   Answering  │  │     Service         │  │
│  └──────────────┘  └──────────────┘  └─────────────────────┘  │
└─────────┬────────────────┬────────────────────┬─────────────────┘
          │                │                    │
          ▼                ▼                    ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐
│  Google Drive   │ │   Cloud SQL     │ │   GCP Services      │
│  (Documents)    │ │  (PostgreSQL    │ │  • Gemini AI        │
│                 │ │   + pgvector)   │ │  • Translation API  │
└─────────────────┘ └─────────────────┘ └─────────────────────┘
```

---

##  How It Works

### 1️ Document Ingestion

```
Google Drive Folder → Download → Extract Text → Chunk → Generate Embeddings → Store in Vector DB
```

**Process:**
- Application monitors Google Drive folder (`GOOGLE_DRIVE_FOLDER_ID`)
- Downloads new/updated documents automatically
- Processes different file types:
  - **PDFs**: Extracted using `pdfjs-dist`
  - **Word Docs**: Extracted using `mammoth`
  - **Excel**: Extracted using `xlsx`
  - **Images**: OCR via Gemini Vision
  - **Videos**: Transcribed using Gemini 2.0
- Text is chunked into 1000-character segments with 200-char overlap
- Each chunk generates a 768-dimensional embedding via Gemini (`models/embedding-001`)
- Stored in Cloud SQL PostgreSQL with pgvector extension

### 2️ Question Answering

```
User Question → Detect Language → Translate to English → Generate Embedding → 
Vector Search → Retrieve Relevant Chunks → Generate Answer → Translate Back → Return
```

**Process:**
1. **Language Detection**: Auto-detects question language
2. **Translation**: Translates to English for search (via Cloud Translation API)
3. **Embedding**: Creates question embedding using Gemini
4. **Vector Search**: Finds top 5 most similar document chunks using cosine similarity
5. **Context Building**: Concatenates relevant chunks
6. **Answer Generation**: Gemini generates concise bullet-point answer
7. **Translation**: Translates answer back to user's language
8. **Response**: Returns formatted answer with sources

### 3️ Web Search Fallback

```
No Relevant Documents Found → Search Web via Gemini → Generate Answer → 
Save to Vector DB → Return with Note
```

**Process:**
1. **Relevance Check**: 
   - Filters stop words from question
   - Requires 50% keyword match + minimum 3 terms
2. **Web Search**: If not relevant, searches via Gemini + Google Search
3. **Answer Generation**: Creates answer from web results
4. **Auto-Save**: Saves answer to vector database for future queries
5. **Notification**: Returns answer with note: "ℹ️ Information retrieved from web search"

---

##  Technology Stack

### Backend
- **Runtime**: Node.js 20
- **Framework**: Express.js
- **Language**: JavaScript (ES Modules)

### AI & ML
- **LLM**: Google Gemini 2.0 Flash (`gemini-2.0-flash-exp`)
- **Embeddings**: Gemini Embedding Model (`models/embedding-001`, 768 dimensions)
- **Web Search**: Gemini with Google Search grounding

### Database
- **Vector DB**: Cloud SQL PostgreSQL 14 with pgvector extension
- **Connection**: Direct TCP connection (104.198.228.120:5432)

### Document Processing
- **PDF**: pdfjs-dist
- **Word**: mammoth
- **Excel**: xlsx
- **Images**: Gemini Vision API
- **Videos**: Gemini 2.0 (multimodal)

### Cloud Services (GCP)
- **Translation**: Cloud Translation API
- **Storage**: Google Drive API
- **AI Platform**: Vertex AI / Gemini API

---

##  Data Flow

### Document Sync Flow
```javascript
// Triggered on startup and every 5 minutes
1. List files in Google Drive folder
2. Check which files are already indexed (compare by name)
3. For each new file:
   a. Download from Google Drive
   b. Extract text based on file type
   c. Split into chunks (1000 chars, 200 overlap)
   d. Generate embeddings for each chunk
   e. Store in Cloud SQL with metadata
4. Log results (new, skipped, failed)
```

### Query Processing Flow
```javascript
// Triggered on POST /api/query
1. Receive question and optional language
2. Detect language if not provided
3. Translate question to English (if needed)
4. Generate question embedding
5. Vector search: SELECT chunks ORDER BY embedding <=> question_embedding LIMIT 5
6. Build context from top chunks
7. Generate answer using Gemini with context
8. Translate answer back to user's language
9. Return {answer, source, language}
```

### Web Search Flow
```javascript
// Triggered when no relevant documents found
1. Check relevance: keywords match >= 50% AND min 3 terms
2. If not relevant:
   a. Search web using Gemini + Google Search
   b. Generate answer from web results
   c. Create embedding for answer
   d. Save to vector DB as new document
   e. Return with "web search" source indicator
3. Next time same question asked → instant from documents
```

---

##  Database Schema

### documents table
```sql
CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    file_name VARCHAR(500) NOT NULL,
    content TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(file_name)
);
```

### document_chunks table
```sql
CREATE TABLE document_chunks (
    id SERIAL PRIMARY KEY,
    document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
    chunk_text TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    embedding vector(768),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ON document_chunks USING ivfflat (embedding vector_cosine_ops);
```

---

##  Environment Variables

### Required GCP Credentials
```env
# Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# Google Drive
GOOGLE_DRIVE_FOLDER_ID=your_drive_folder_id
GOOGLE_PROJECT_ID=your_gcp_project_id
GOOGLE_PRIVATE_KEY_ID=your_key_id
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
GOOGLE_CLIENT_EMAIL=service-account@project.iam.gserviceaccount.com
GOOGLE_CLIENT_ID=your_client_id

# Or use JSON credentials
GOOGLE_APPLICATION_CREDENTIALS_JSON='{"type":"service_account",...}'
```

### Required Database
```env
CLOUD_SQL_HOST=104.198.228.120
CLOUD_SQL_PORT=5432
CLOUD_SQL_DATABASE=ragdb
CLOUD_SQL_USER=raguser
CLOUD_SQL_PASSWORD=your_password
```

### Optional Configuration
```env
NODE_ENV=production
PORT=3000
GCP_PROJECT_ID=your-project-id
GCP_REGION=us-east4
USE_GCP_SEARCH=true
GCP_TRANSLATION_ENABLED=true
```

---

##  API Endpoints

### Document Management
```bash
# List all documents
GET /api/documents

# Upload document manually
POST /api/documents/upload
Content-Type: multipart/form-data
Body: { file: <file> }

# Delete document
DELETE /api/documents/:fileName

# Delete all documents
DELETE /api/documents
```

### Google Drive Sync
```bash
# Full sync (backend only)
POST /api/drive/sync

# Check for new files
POST /api/drive/check-new

# Get sync status
GET /api/drive/status

# Clear sync cache
POST /api/drive/clear-cache
```

### Question Answering
```bash
# Ask a question
POST /api/query
Content-Type: application/json
Body: {
  "question": "How do I access the water manifold?",
  "language": "en"  # optional, auto-detected
}

Response: {
  "answer": "• Step 1...\n• Step 2...",
  "source": "documents" | "web_search",
  "language": "en",
  "translatedQuestion": "...",
  "usedInternetSearch": false
}
```

### Health Check
```bash
GET /health
Response: { "status": "ok", "timestamp": "..." }
```

---

##  Performance Metrics

- **Document Processing**: ~2-5 seconds per document
- **Question Answering**: ~1-3 seconds (cached embeddings)
- **Web Search Fallback**: ~3-5 seconds
- **Vector Search**: <100ms for 1000 documents
- **Concurrent Users**: 10+ (with 2 pod replicas)

---

##  Security Features

- **Secrets Management**: Azure Key Vault integration
- **API Authentication**: Service account credentials
- **Network Security**: TLS/SSL for all connections
- **Database**: Encrypted at rest and in transit
- **RBAC**: Kubernetes role-based access control

---

##  Deployment

Runs on Azure Kubernetes Service (AKS) with:
- **2 pod replicas** (high availability)
- **Auto-scaling**: 2-10 pods based on CPU/memory
- **Health checks**: Liveness and readiness probes
- **Load balancer**: External IP with session affinity
- **Resource limits**: 512Mi-2Gi RAM, 250m-1 CPU per pod

See [KUBERNETES_DEPLOYMENT.md](./KUBERNETES_DEPLOYMENT.md) for detailed setup instructions.

---

##  Example Usage

### Ask a Question (English)
```bash
curl -X POST http://20.75.198.140/api/query \
  -H "Content-Type: application/json" \
  -d '{"question": "How do I reset the printer?"}'
```

Response:
```json
{
  "answer": "• Turn off the printer using the power button\n• Wait 30 seconds\n• Unplug power cable from back\n• Wait 1 minute\n• Plug back in and power on",
  "source": "documents",
  "language": "en"
}
```

### Ask a Question (Spanish)
```bash
curl -X POST http://20.75.198.140/api/query \
  -H "Content-Type: application/json" \
  -d '{"question": "¿Cómo reinicio la impresora?"}'
```

Response:
```json
{
  "answer": "• Apague la impresora con el botón de encendido\n• Espere 30 segundos\n• Desenchufe el cable...",
  "source": "documents",
  "language": "es"
}
```

---

##  Additional Resources

- [GCP Documentation](https://cloud.google.com/docs)
- [Gemini API Reference](https://ai.google.dev/docs)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Kubernetes Deployment Guide](./KUBERNETES_DEPLOYMENT.md)

---

##  Support

For issues or questions:
1. Check logs: `kubectl logs -f deployment/rag-app -n rag-app-gcp`
2. Verify all environment variables are set correctly
3. Ensure Cloud SQL is accessible from AKS cluster

---

**Version**: 1.0  
**Last Updated**: December 2025  
**License**: MIT