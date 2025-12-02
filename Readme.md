# Azure RAG Application - Complete Documentation

---

## Overview

This is an enterprise-grade Retrieval-Augmented Generation (RAG) application built on Microsoft Azure infrastructure with Google Cloud integration. The system enables intelligent document processing and querying across multiple file formats including videos, PDFs, Word documents, Excel spreadsheets, and images, with automatic synchronization from Google Drive and support for 60+ languages.

### Key Capabilities

- **Google Drive Integration**: Automatic document synchronization with smart caching
- **Multi-Language Support**: Ask questions and receive answers in 60+ languages
- **Multi-format Document Processing**: Supports PDF, DOCX, XLSX, PNG, JPG, and MP4 files
- **Video Intelligence**: Extracts both audio transcription and visual content through OCR
- **Semantic Search**: Vector-based similarity search with intelligent file filtering
- **Intelligent Answering**: Powered by Google Gemini 2.5 Flash for advanced reasoning
- **Dual Deployment Architecture**: Load-balanced embeddings with automatic failover
- **Scalable Architecture**: Built on Azure cloud services for enterprise reliability

### Use Cases

- Enterprise document management and search
- Video content analysis and transcription
- Knowledge base query systems
- Multi-language document processing
- Document comparison and analysis
- Automated Google Drive document indexing

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT APPLICATION                       │
│         (Web Browser, cURL, Postman, Frontend App)           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ HTTP REST API
                     │
┌────────────────────▼────────────────────────────────────────┐
│                   EXPRESS.JS SERVER                          │
│                    (Port 3000)                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Routes: /api/documents, /api/query, /api/sync      │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┼────────────────────┐
        │            │            │        │
        ▼            ▼            ▼        ▼
┌──────────────┬──────────────┬──────────────┬──────────────┐
│  Google      │  Document    │   Search     │     RAG      │
│  Drive       │  Processor   │   Service    │   Service    │
│  Service     │              │              │              │
└──────┬───────┴──────┬───────┴──────┬───────┴──────┬───────┘
       │              │              │              │
       │              │              │              │
┌──────▼──────────────▼──────────────▼──────────────▼─────────┐
│               AZURE CLOUD SERVICES                           │
│  ┌──────────────┬──────────────┬───────────────────────┐  │
│  │ Blob Storage │  AI Search   │  Document Intelligence│  │
│  │ (Files)      │ (Vectors)    │  (OCR)                │  │
│  └──────────────┴──────────────┴───────────────────────┘  │
│  ┌──────────────┬──────────────┬───────────────────────┐  │
│  │ OpenAI       │ OpenAI       │  Speech               │  │
│  │ Deployment 1 │ Deployment 2 │  (Audio STT)          │  │
│  │ (Primary)    │ (Backup)     │                       │  │
│  └──────────────┴──────────────┴───────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Translator Service (60+ languages)                   │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                     │
                     │
┌────────────────────▼────────────────────────────────────────┐
│              GOOGLE CLOUD SERVICES                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Google Drive API - Document Source                   │  │
│  │ Google Gemini 2.5 Flash - Answer Generation (FREE!)  │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Data Flow

#### Google Drive Sync Flow (NEW)

1. Server starts or user clicks "Check for New Files"
2. Google Drive Service connects to Google Drive API
3. Lists all files in configured folder
4. Compares with .sync-cache.json to detect new/modified files
5. Downloads only changed files
6. Triggers document processing pipeline
7. Updates cache with processed file info

#### Upload Flow

1. Client sends file via HTTP POST OR file auto-synced from Google Drive
2. Express server receives and validates file
3. Document Processor extracts content based on file type
4. Language detected and document translated to English if needed (NEW)
5. Embedding Service generates vector embeddings (1536 dimensions) using dual deployment
6. Search Service indexes content in Azure AI Search
7. Response returned to client

#### Query Flow (ENHANCED)

1. Client sends question via HTTP POST
2. Language detected from question (NEW)
3. Question translated to English if needed (NEW)
4. Specific file name extracted if mentioned (NEW)
5. Embedding Service generates query vector using dual deployment (NEW)
6. Search Service performs vector similarity search
7. Results filtered to specific file if mentioned (NEW)
8. Relevant documents retrieved from Azure AI Search
9. RAG Service sends context + question to Gemini
10. Gemini generates intelligent answer
11. Answer translated back to user's language if needed (NEW)
12. Response with answer and sources returned to client

---

## Technology Stack

### Core Technologies

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Runtime** | Node.js 18+ | Server runtime environment |
| **Framework** | Express.js 4.x | REST API framework |
| **Language** | JavaScript (ES Modules) | Application language |

### Azure Services

| Service | Purpose | Configuration |
|---------|---------|---------------|
| **Azure Blob Storage** | File storage | Container: documents, Account: ragapphr1na3 |
| **Azure AI Search** | Vector search & indexing | Index: documents-index, Service: ragsearche6bg7z, Dimension: 1536 |
| **Azure OpenAI** | Embedding generation (dual deployment) | Model: text-embedding-ada-002 (2 deployments) |
| **Azure Document Intelligence** | OCR for PDFs and images | Prebuilt document model |
| **Azure Speech Service** | Video audio transcription | REST API, Region: East US |
| **Azure Translator** | Multi-language support | 60+ languages, Region: East US |

### Google Cloud Services

| Service | Purpose | Model/Configuration |
|---------|---------|---------------------|
| **Google Drive API** | Document source & sync | Folder ID: 1KZfiRviWSPsDxkuq5CX2Zny47zlaEgZC |
| **Google Gemini** | Answer generation | gemini-2.5-flash (FREE tier) |

### Key Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| `@azure/storage-blob` | Latest | Blob storage operations |
| `@azure/search-documents` | Latest | Search indexing and querying |
| `@azure/openai` | Latest | Embedding generation |
| `@azure/ai-form-recognizer` | Latest | Document intelligence |
| `@google/generative-ai` | Latest | Gemini API client |
| `googleapis` | Latest | Google Drive API client |
| `multer` | 1.4.x | File upload handling |
| `mammoth` | Latest | DOCX processing |
| `xlsx` | Latest | Excel file processing |
| `ffmpeg` | System | Video processing |

---

## What's New - Recent Updates

### 1. Google Drive Integration 

**Features:**
- Automatic document synchronization on server startup
- Manual sync via "Check for New Files" button
- Smart caching prevents re-processing (`.sync-cache.json`)
- Supports 29+ documents currently
- Detects new and modified files automatically

**Setup:**
```bash
# Add to .env
GOOGLE_DRIVE_FOLDER_ID=your_folder_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### 2. Multi-Language Support 

**Features:**
- Supports 60+ languages (English, Chinese, Spanish, French, German, Japanese, Korean, Arabic, Hindi, Tamil, Telugu, and more)
- Automatic language detection for documents and questions
- Documents translated to English for consistent indexing
- Questions translated to English for better search
- Answers translated back to user's language
- Works seamlessly without user language selection

**Languages Supported:**
English, Spanish, French, German, Italian, Portuguese, Chinese (Simplified & Traditional), Japanese, Korean, Arabic, Russian, Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Urdu, Sinhala, Vietnamese, Thai, Indonesian, Malay, Turkish, Polish, Dutch, Swedish, Danish, Norwegian, Finnish, Greek, Czech, Romanian, Hungarian, and more.

**Example Flow:**
```
User asks in Chinese: "如何清洁打印头?"
→ Detected: Chinese
→ Translated to English: "How to clean the print head?"
→ Search documents (indexed in English)
→ Generate answer in English
→ Translate back to Chinese
→ Return: "根据维护指南，清洁打印头的步骤：..."
```

### 3. Dual Deployment Architecture 

**Features:**
- Two Azure OpenAI embedding deployments for load balancing
- Automatic alternation between deployments
- Automatic failover if one hits rate limit
- Auto-retry with 60-second delay if both rate limited
- Doubles capacity: 240K tokens/min (2 × 120K)
- Zero rate limit errors during processing

**Configuration:**
```bash
# Add to .env
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-ada-002
AZURE_OPENAI_EMBEDDING_DEPLOYMENT_BACKUP=text-embedding-ada-002-backup
```

**Benefits:**
-  Process large document batches without errors
-  2× embedding capacity
-  Automatic load balancing
-  Resilient to rate limits

### 4. Smart File Filtering 🎯

**Features:**
- Detects specific file names mentioned in questions
- Fuzzy matching for file names (handles typos, missing extensions)
- Filters search results to only show specified file
- Similarity threshold: 70%
- Uses Levenshtein distance for matching

**Example:**
```
Question: "Explain the content in Blanket TDS.pdf"
→ Detected file: "Blanket TDS.pdf"
→ Filters results to only chunks from this file
→ Shows only sources from "Blanket TDS.pdf"
```

**Patterns Recognized:**
- "explain about X.pdf"
- "what is in document Y"
- "the content in Z"
- "tell me about file ABC"

### 5. Enhanced Document Processing 

**Improvements:**
- Fixed chunk.text undefined bug (critical fix)
- Better text extraction from videos
- Improved language detection
- Better handling of Chinese and multilingual documents
- More robust error handling

### 6. Persistent Smart Caching 

**Features:**
- `.sync-cache.json` tracks all processed files
- Prevents re-processing on server restart
- Compares file modified times
- Only processes new or changed files
- Significantly faster server startup

**Cache Structure:**
```json
{
  "fileId123": {
    "name": "document.pdf",
    "modifiedTime": "2025-11-28T10:00:00Z",
    "indexed": true,
    "chunks": 5
  }
}
```

---

## API Usage Guide

### Base URL

```
http://localhost:3000
```

For production, replace with your deployed server URL.

---

### Using cURL

cURL is a command-line tool for making HTTP requests. It is ideal for testing APIs and automation.

#### Installation

**Windows:**
- Download from: https://curl.se/windows/
- Or use Git Bash which includes cURL

**macOS:**
- Pre-installed

**Linux:**
```bash
sudo apt-get install curl
```

#### Basic cURL Syntax

```bash
curl [OPTIONS] [URL]
```

Common options:
- `-X`: HTTP method (GET, POST, DELETE)
- `-H`: Add header
- `-d`: Send data
- `-F`: Send form data (for file uploads)
- `-o`: Save response to file

---

### API Endpoints

#### 1. Upload Document

**Endpoint:** `POST /api/documents/upload`

**Description:** Upload and process a document (PDF, DOCX, XLSX, Image, or Video)

**cURL Example:**

```bash
# Upload a PDF
curl -X POST http://localhost:3000/api/documents/upload \
  -F "file=@/path/to/document.pdf"

# Upload a video
curl -X POST http://localhost:3000/api/documents/upload \
  -F "file=@/path/to/video.mp4"

# Upload with response saved to file
curl -X POST http://localhost:3000/api/documents/upload \
  -F "file=@document.pdf" \
  -o response.json
```

**Postman Instructions:**

1. Open Postman
2. Create a new request
3. Set method to **POST**
4. Enter URL: `http://localhost:3000/api/documents/upload`
5. Go to **Body** tab
6. Select **form-data**
7. Add a key named `file`
8. Change key type from "Text" to "File" (dropdown on right)
9. Click "Select Files" and choose your document
10. Click **Send**

**Response Example:**

```json
{
  "success": true,
  "message": "Document uploaded and processed successfully",
  "document": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "fileName": "document.pdf",
    "fileType": "application/pdf",
    "language": "english",
    "originalLanguage": "zh",
    "translatedToEnglish": false,
    "chunks": 5,
    "uploadDate": "2025-11-24T15:30:00.000Z"
  }
}
```

**Status Codes:**
- `200`: Success
- `400`: Invalid file or bad request
- `500`: Server error during processing

---

#### 2. Query Documents (ENHANCED)

**Endpoint:** `POST /api/query`

**Description:** Ask questions about your uploaded documents in any language

**cURL Example:**

```bash
# Simple query in English
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What files have been uploaded?"
  }'

# Query in Chinese
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "如何清洁打印头?"
  }'

# Query about specific file
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Can you explain the content in Blanket TDS.pdf?"
  }'

# Query with language parameter (optional)
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is in my documents?",
    "language": "english"
  }'
```

**Postman Instructions:**

1. Create a new request
2. Set method to **POST**
3. Enter URL: `http://localhost:3000/api/query`
4. Go to **Headers** tab
5. Add header: `Content-Type: application/json`
6. Go to **Body** tab
7. Select **raw**
8. Select **JSON** from dropdown
9. Enter JSON body:
```json
{
  "question": "What files have been uploaded?",
  "language": "english"
}
```
10. Click **Send**

**Request Body Schema:**

```json
{
  "question": "string (required)",
  "language": "string (optional, auto-detected if not provided)"
}
```

**Response Example:**

```json
{
  "success": true,
  "question": "What files have been uploaded?",
  "answer": "Based on your documents, the following files have been uploaded:\n1. document.pdf - A PDF containing...\n2. spreadsheet.xlsx - An Excel file with...",
  "sources": [
    {
      "id": "doc-id-chunk-0",
      "content": "Document content...",
      "fileName": "document.pdf",
      "fileType": "application/pdf",
      "language": "english",
      "uploadDate": "2025-11-24T15:30:00.000Z",
      "score": 0.85,
      "metadata": {
        "blobName": "blob-name.pdf",
        "chunkIndex": 0,
        "totalChunks": 5,
        "pageCount": 10,
        "originalLanguage": "zh",
        "indexedInEnglish": true
      }
    }
  ],
  "usedInternetSearch": false,
  "usedGemini": true,
  "model": "gemini-2.5-flash",
  "language": "english",
  "detectedLanguage": "en",
  "translated": false,
  "specificFileFiltered": false,
  "timestamp": "2025-11-24T15:35:00.000Z"
}
```

**Status Codes:**
- `200`: Success
- `400`: Missing or invalid question
- `500`: Server error during processing

---

#### 3. Google Drive Sync (NEW)

**Endpoint:** `POST /api/sync/drive`

**Description:** Manually trigger Google Drive synchronization

**cURL Example:**

```bash
curl -X POST http://localhost:3000/api/sync/drive
```

**Postman Instructions:**

1. Create a new request
2. Set method to **POST**
3. Enter URL: `http://localhost:3000/api/sync/drive`
4. Click **Send**

**Response Example:**

```json
{
  "success": true,
  "message": "Sync completed successfully",
  "stats": {
    "totalFiles": 29,
    "newFiles": 2,
    "modifiedFiles": 1,
    "skippedFiles": 26,
    "failedFiles": 0,
    "processedSuccessfully": 3
  },
  "timestamp": "2025-11-28T10:30:00.000Z"
}
```

**Note:** Sync also runs automatically on server startup.

---

#### 4. Batch Query

**Endpoint:** `POST /api/query/batch`

**Description:** Process multiple questions at once

**cURL Example:**

```bash
curl -X POST http://localhost:3000/api/query/batch \
  -H "Content-Type: application/json" \
  -d '{
    "questions": [
      "What files were uploaded?",
      "What is in the spreadsheet?",
      "How many documents do I have?"
    ],
    "language": "english"
  }'
```

**Postman Instructions:**

Same as single query, but use body:
```json
{
  "questions": [
    "Question 1",
    "Question 2",
    "Question 3"
  ],
  "language": "english"
}
```

**Response Example:**

```json
{
  "success": true,
  "count": 3,
  "results": [
    {
      "question": "What files were uploaded?",
      "answer": "...",
      "sources": [...],
      "success": true
    },
    {
      "question": "What is in the spreadsheet?",
      "answer": "...",
      "sources": [...],
      "success": true
    }
  ],
  "timestamp": "2025-11-24T15:40:00.000Z"
}
```

---

#### 5. List Documents

**Endpoint:** `GET /api/documents`

**Description:** Get a list of all uploaded documents

**cURL Example:**

```bash
curl http://localhost:3000/api/documents
```

**Postman Instructions:**

1. Create a new request
2. Set method to **GET**
3. Enter URL: `http://localhost:3000/api/documents`
4. Click **Send**

**Response Example:**

```json
{
  "success": true,
  "count": 29,
  "documents": [
    {
      "fileName": "document.pdf",
      "fileType": "application/pdf",
      "uploadDate": "2025-11-24T15:30:00.000Z",
      "language": "english",
      "originalLanguage": "zh",
      "source": "google_drive"
    },
    {
      "fileName": "spreadsheet.xlsx",
      "fileType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "uploadDate": "2025-11-24T15:32:00.000Z",
      "language": "english",
      "source": "upload"
    }
  ]
}
```

---

#### 6. Delete Document

**Endpoint:** `DELETE /api/documents/:filename`

**Description:** Delete a specific document and all its chunks

**cURL Example:**

```bash
curl -X DELETE http://localhost:3000/api/documents/document.pdf
```

**Postman Instructions:**

1. Create a new request
2. Set method to **DELETE**
3. Enter URL: `http://localhost:3000/api/documents/document.pdf`
4. Click **Send**

**Response Example:**

```json
{
  "success": true,
  "message": "Document deleted successfully",
  "deleted": 5
}
```

---

#### 7. Delete All Documents (NEW)

**Endpoint:** `DELETE /api/documents`

**Description:** Delete all documents and reset the system

**cURL Example:**

```bash
curl -X DELETE http://localhost:3000/api/documents
```

**Response Example:**

```json
{
  "success": true,
  "message": "All documents deleted successfully",
  "deleted": 150
}
```

---

### Postman Collection Setup

To create a complete Postman collection:

1. **Create New Collection:**
   - Click "New" > "Collection"
   - Name it "Azure RAG API v2"

2. **Add Requests:**
   - Add all 7 endpoints described above
   - Save each request in the collection

3. **Set Environment Variables:**
   - Click "Environments" > "Create Environment"
   - Add variable: `base_url` = `http://localhost:3000`
   - Use `{{base_url}}` in your requests

4. **Create Test Scripts:**
   - In each request, go to "Tests" tab
   - Add assertions to validate responses

Example test script:
```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Response has success field", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('success');
    pm.expect(jsonData.success).to.be.true;
});

pm.test("Language detection working", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('detectedLanguage');
});
```

---

## File Structure

```
azure-rag-app/
│
├── src/
│   ├── config/
│   │   └── azureClients.js          # Azure service client initialization
│   │
│   ├── routes/
│   │   ├── documentRoutes.js        # Document upload/delete endpoints
│   │   ├── queryRoutes.js           # Query endpoints
│   │   └── syncRoutes.js            # Google Drive sync endpoint (NEW)
│   │
│   ├── services/
│   │   ├── driveSyncService.js      # Google Drive synchronization (NEW)
│   │   ├── documentProcessor.js     # Multi-format document processing
│   │   ├── embeddingService.js      # Vector embedding with dual deployment (UPDATED)
│   │   ├── searchService.js         # Azure Search operations (UPDATED)
│   │   ├── ragService.js            # RAG query processing (UPDATED)
│   │   ├── translatorService.js     # Multi-language translation (NEW)
│   │   └── webSearchService.js      # Internet search fallback (optional)
│   │
│   └── server.js                    # Express server entry point
│
├── .sync-cache.json                  # Google Drive sync cache (auto-generated)
├── .env                              # Environment variables (not in repo)
├── .gitignore                        # Git ignore rules
├── package.json                      # Node.js dependencies
├── package-lock.json                 # Dependency lock file
└── README.md                         # This file
```

---

## Core Components

### 1. server.js

**Purpose:** Express server initialization and middleware configuration

**Key Responsibilities:**
- Initialize Express application
- Configure CORS for cross-origin requests
- Set up body parsing middleware
- Configure Multer for file uploads (no size limit)
- Register API routes (documents, query, sync)
- Trigger Google Drive sync on startup (NEW)
- Start HTTP server on port 3000

**Key Code:**
```javascript
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { driveSyncService } from './services/driveSyncService.js';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());
app.use('/api/documents', documentRouter);
app.use('/api/query', queryRouter);
app.use('/api/sync', syncRouter); // NEW

// Auto-sync on startup
await driveSyncService.syncFromDrive();

app.listen(3000);
```

---

### 2. services/driveSyncService.js (NEW)

**Purpose:** Synchronize documents from Google Drive to Azure

**Key Features:**
- Connects to Google Drive API using service account
- Lists files in configured folder
- Smart caching with `.sync-cache.json`
- Detects new and modified files
- Downloads and processes only changed files
- Updates cache after successful processing

**Key Methods:**

**`syncFromDrive()`**
- Main synchronization method
- Lists files from Google Drive
- Compares with cache
- Downloads new/modified files
- Processes and indexes files
- Updates cache

**`listDriveFiles()`**
- Lists all files in Google Drive folder
- Returns file metadata (id, name, modified time)

**`downloadFile(fileId)`**
- Downloads file from Google Drive
- Returns file buffer

**Processing Flow:**
```
1. List files from Google Drive
2. Load .sync-cache.json
3. For each file:
   - Check if in cache
   - Check if modified
   - If new/modified: download → process → index
   - If unchanged: skip
4. Update cache with processed files
5. Save cache to disk
```

**Cache Benefits:**
-  Fast server restarts (only process new files)
-  Saves API calls
-  Prevents duplicate processing
-  Tracks processing status

---

### 3. services/translatorService.js (NEW)

**Purpose:** Multi-language translation for documents and queries

**Key Features:**
- Automatic language detection (60+ languages)
- Document translation to English for indexing
- Question translation to English for search
- Answer translation back to user's language
- Azure Translator integration
- Fallback pattern matching for detection

**Key Methods:**

**`detectLanguage(text)`**
- Detects language from text
- Uses Azure Translator API
- Falls back to pattern matching
- Returns ISO language code (e.g., "en", "zh", "es")

**`translateToEnglish(text, sourceLanguage)`**
- Translates document to English
- Handles large texts (45,000 char chunks)
- Returns translated text + metadata

**`translateAnswer(englishAnswer, targetLanguage)`**
- Translates answer to user's language
- Preserves formatting
- Returns translated text

**Supported Languages:**
English (en), Spanish (es), French (fr), German (de), Italian (it), Portuguese (pt), Chinese Simplified (zh-Hans), Chinese Traditional (zh-Hant), Japanese (ja), Korean (ko), Arabic (ar), Russian (ru), Hindi (hi), Bengali (bn), Tamil (ta), Telugu (te), Marathi (mr), Gujarati (gu), Kannada (kn), Malayalam (ml), Punjabi (pa), Urdu (ur), Sinhala (si), Vietnamese (vi), Thai (th), Indonesian (id), Malay (ms), Turkish (tr), Polish (pl), Dutch (nl), Swedish (sv), Danish (da), Norwegian (no), Finnish (fi), Greek (el), Czech (cs), Romanian (ro), Hungarian (hu), and more.

**Language Names Map:**
```javascript
{
  'en': 'English',
  'zh-Hans': 'Chinese (Simplified)',
  'zh-Hant': 'Chinese (Traditional)',
  'es': 'Spanish',
  'fr': 'French',
  // ... 60+ languages
}
```

---

### 4. services/embeddingService.js (UPDATED)

**Purpose:** Generate vector embeddings with dual deployment architecture

**Key Features:**
- Dual deployment (primary + backup)
- Automatic load balancing
- Automatic failover on rate limits
- Auto-retry with 60-second delay
- 2× capacity (240K tokens/min)

**Key Methods:**

**`generateEmbeddings(texts)`**
- Accepts array of text strings
- Alternates between primary and backup deployments
- Handles rate limits automatically
- Returns array of 1536-dimensional vectors

**Dual Deployment Logic:**
```javascript
Request 1 → Primary deployment (text-embedding-ada-002)
Request 2 → Backup deployment (text-embedding-ada-002-backup)
Request 3 → Primary deployment
Request 4 → Backup deployment
...

If Primary hits rate limit:
  → Switch to Backup immediately
  → Continue processing

If BOTH hit rate limit:
  → Wait 60 seconds
  → Reset both flags
  → Retry automatically
```

**Benefits:**
-  2× capacity (240K tokens/min vs 120K)
-  Zero rate limit errors
-  Automatic failover
-  Resilient processing

**Technical Details:**
- Model: text-embedding-ada-002
- Dimension: 1536 (matches Azure Search index)
- Cost: approximately $0.0001 per 1000 tokens
- Deployments: Primary + Backup (load balanced)

---

### 5. services/searchService.js (UPDATED)

**Purpose:** Interface with Azure AI Search with smart file filtering

**Key Updates:**
- File name filtering with fuzzy matching
- Improved search result ranking
- Better metadata handling

**Key Methods:**

**`searchDocuments(queryInput, topK)`**
- Accepts query vector or text
- Performs vector similarity search
- Returns top K most relevant document chunks
- Includes relevance scores and metadata

**Search Process:**
1. Check if input is already a vector or needs embedding
2. Generate embedding if text input
3. Perform vector search in Azure AI Search
4. Return ranked results with scores

**`indexDocument(document)`**
- Indexes document chunks in Azure AI Search
- Stores content, vector, metadata
- Metadata includes language info (NEW)
- Metadata stored as JSON string (Azure requirement)

**Index Schema (UPDATED):**
```javascript
{
  id: "unique-chunk-id",
  content: "text content",
  contentVector: [1536 float values],
  fileName: "document.pdf",
  fileType: "application/pdf",
  language: "english",
  uploadDate: "ISO timestamp",
  metadata: JSON.stringify({
    originalLanguage: "zh",
    indexedInEnglish: true,
    translatedToEnglish: true,
    chunkIndex: 0,
    totalChunks: 5
  })
}
```

**`deleteDocumentsByFileName(fileName)`**
- Removes all chunks for a specific file
- Cleans up both content and vectors

**`getAllDocuments()`**
- Returns list of all indexed documents
- Deduplicates by filename
- Includes upload dates, languages, and file types

---

### 6. services/ragService.js (UPDATED)

**Purpose:** Enhanced RAG query processing with multi-language support and file filtering

**Key Updates:**
- Language detection for questions
- Question translation to English
- Specific file name extraction and filtering
- Answer translation back to user's language
- Fuzzy file name matching

**Key Methods:**

**`generateAnswer(question, language)`**

**Enhanced Process:**

1. **Language Detection:**
   - Detect question language using translatorService
   - Store detected language for answer translation

2. **File Name Detection:**
   - Extract specific file name from question if mentioned
   - Examples: "explain X.pdf", "what is in document Y"
   - Use fuzzy matching (70% similarity threshold)

3. **Question Translation:**
   - Translate question to English if needed
   - Use English for consistent search

4. **Embedding Generation:**
   - Convert question to 1536-dim vector
   - Use dual deployment for load balancing

5. **Retrieval:**
   - Search Azure AI Search for top 10 relevant chunks
   - Ranked by vector similarity

6. **File Filtering:**
   - If specific file detected, filter results
   - Use fuzzy matching (Levenshtein distance)
   - Only show chunks from specified file

7. **Context Building:**
   - Combine retrieved chunks into context
   - Include source attribution

8. **Answer Generation:**
   - Send context + question to Google Gemini 2.5 Flash
   - Gemini generates intelligent, contextual answer

9. **Answer Translation:**
   - Translate answer back to user's language if needed
   - Preserve formatting

10. **Response Formatting:**
    - Return answer with source citations
    - Include metadata (language, translation status, file filtering)

**New Helper Methods:**

**`extractFileName(question)`**
- Extracts file name from question
- Patterns: "about file X", "in document Y", "explain Z.pdf"
- Returns file name or null

**`calculateSimilarity(str1, str2)`**
- Calculates string similarity (0-1)
- Uses Levenshtein distance
- Used for fuzzy file name matching

**`levenshteinDistance(str1, str2)`**
- Calculates edit distance between strings
- Used by similarity calculation

**Why Gemini for Answers:**
- Superior reasoning capabilities
- Better at "how-to" questions
- Provides step-by-step guidance
- Free tier available
- Handles complex queries effectively
- Excellent multi-language support

**Answer Quality Features:**
- Context-aware responses
- References actual documents
- Provides practical guidance
- Includes code examples when relevant
- Separates document content from general knowledge
- Works in any language

---

### 7. config/azureClients.js

**Purpose:** Centralized Azure service client initialization

**Key Responsibilities:**
- Initialize Azure Blob Storage client
- Initialize Azure AI Search client
- Initialize Azure OpenAI client (dual deployments)
- Initialize Azure Document Intelligence client
- Initialize Azure Translator client (NEW)
- Export configured clients for use across services

**Services Configured:**
- BlobServiceClient for file storage
- SearchClient for vector search
- OpenAIClient for embeddings (2 deployments)
- DocumentAnalysisClient for OCR
- TranslatorClient for multi-language support

---

### 8. routes/documentRoutes.js

**Purpose:** Handle document upload and management endpoints

**Endpoints:**
- `POST /api/documents/upload` - Upload and process new document
- `GET /api/documents` - List all documents
- `DELETE /api/documents/:filename` - Delete specific document
- `DELETE /api/documents` - Delete all documents (NEW)

**Key Responsibilities:**
- Receive file uploads via Multer
- Validate file types
- Call documentProcessor to extract content
- Call translatorService to detect/translate if needed (NEW)
- Call embeddingService to generate vectors
- Call searchService to index content
- Handle errors and return responses

**Processing Flow (UPDATED):**
```
File Upload
    → Validate file type
    → Extract content (documentProcessor)
    → Detect language (translatorService)
    → Translate to English if needed (translatorService)
    → Chunk text
    → Generate embeddings (embeddingService with dual deployment)
    → Index in Azure Search (searchService)
    → Return success response with language info
```

---

### 9. routes/queryRoutes.js

**Purpose:** Handle query endpoints for asking questions

**Endpoints:**
- `POST /api/query` - Single question query (enhanced with multi-language)
- `POST /api/query/batch` - Multiple questions query

**Key Responsibilities:**
- Validate incoming questions
- Call ragService to process query (handles translation automatically)
- Return structured responses with sources and language metadata

**Query Flow (UPDATED):**
```
Question Received
    → Validate input
    → Generate answer (ragService handles all translation)
    → Return answer with sources + language metadata
```

---

### 10. routes/syncRoutes.js (NEW)

**Purpose:** Handle Google Drive synchronization endpoint

**Endpoints:**
- `POST /api/sync/drive` - Trigger manual sync

**Key Responsibilities:**
- Call driveSyncService.syncFromDrive()
- Return sync statistics
- Handle errors gracefully

---

### 11. services/documentProcessor.js

**Purpose:** Extract and process content from various file formats

**Supported Formats:**
- PDF (via Azure Document Intelligence)
- DOCX (via Mammoth library)
- XLSX (via SheetJS library)
- Images: PNG, JPG (via Azure Document Intelligence)
- Videos: MP4, MOV, AVI (via FFmpeg + Azure Speech + Azure Document Intelligence)

**Key Methods:**

**`uploadToBlob(file, fileName)`**
- Uploads file to Azure Blob Storage
- Returns blob name and URL

**`extractText(fileBuffer, fileType)`**
- Routes to appropriate extraction method based on file type
- Returns extracted text, tables, and page count

**`processVideo(file)`**
- Comprehensive video processing pipeline
- Extracts audio using FFmpeg
- Transcribes audio using Azure Speech REST API
- Extracts frames (1 per 5 seconds, max 10 frames)
- Performs OCR on frames using Azure Document Intelligence
- Combines audio transcript and visual text
- Returns combined content

**Video Processing Details:**

1. **Audio Extraction:**
   - Uses FFmpeg to extract audio track
   - Converts to 16kHz mono WAV format
   - Handles videos without audio gracefully

2. **Audio Transcription:**
   - Sends audio to Azure Speech REST API
   - Receives text transcript
   - Handles transcription errors

3. **Visual Analysis:**
   - Extracts video frames using FFmpeg
   - Saves frames as JPEG images
   - Performs OCR on each frame
   - Extracts visible text, UI elements, code

4. **Content Combination:**
   - Merges audio transcript and visual text
   - Creates searchable content even for silent videos
   - Includes file metadata if no content found

**`chunkText(text, chunkSize, overlap)`**
- Splits text into overlapping chunks
- Default: 1000 words per chunk, 200 word overlap
- Ensures context preservation across chunks
- Returns array of text strings (fixed bug: was returning objects)

**`detectLanguage(text)`**
- Detects document language using pattern matching
- Supports: English, Spanish, French, German, Chinese, Arabic, Russian
- Defaults to English if detection fails

---

### 12. services/webSearchService.js (Optional)

**Purpose:** Internet search fallback when documents do not contain answer

**Key Method:**

**`searchWeb(query)`**
- Falls back to Bing Search API when needed
- Supplements document knowledge with web search
- Currently configured but not actively used

**Note:** This is an optional feature that can be enabled if needed for queries that extend beyond uploaded documents.

---

## Configuration

### Environment Variables

The application requires the following environment variables in `.env` file:

```bash
# Azure Storage
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;...
STORAGE_CONTAINER_NAME=documents

# Azure OpenAI (for embeddings - DUAL DEPLOYMENT)
AZURE_OPENAI_ENDPOINT=https://eastus.api.cognitive.microsoft.com/
AZURE_OPENAI_API_KEY=your_key_here
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-ada-002
AZURE_OPENAI_EMBEDDING_DEPLOYMENT_BACKUP=text-embedding-ada-002-backup

# Google Gemini (for answers)
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash

# Google Drive Integration (NEW)
GOOGLE_DRIVE_FOLDER_ID=1KZfiRviWSPsDxkuq5CX2Zny47zlaEgZC
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Azure AI Search
AZURE_SEARCH_ENDPOINT=https://ragsearche6bg7z.search.windows.net
AZURE_SEARCH_API_KEY=your_key_here
AZURE_SEARCH_INDEX_NAME=documents-index

# Azure Document Intelligence
AZURE_DOC_INTELLIGENCE_ENDPOINT=https://eastus.api.cognitive.microsoft.com/
AZURE_DOC_INTELLIGENCE_KEY=your_key_here

# Azure Speech Service (for video transcription)
AZURE_SPEECH_KEY=your_key_here
AZURE_SPEECH_REGION=eastus

# Azure Translator (NEW - for multi-language support)
AZURE_TRANSLATOR_KEY=your_key_here
AZURE_TRANSLATOR_ENDPOINT=https://api.cognitive.microsofttranslator.com
AZURE_TRANSLATOR_REGION=eastus

# Server Configuration
PORT=3000
NODE_ENV=development
```

### Google Drive Setup (NEW)

**Prerequisites:**
1. Google Cloud Project
2. Service Account created
3. Service Account JSON key downloaded
4. Google Drive folder shared with service account

**Setup Steps:**

1. **Create Google Cloud Project:**
   - Go to https://console.cloud.google.com
   - Create new project

2. **Enable Google Drive API:**
   - Navigate to "APIs & Services"
   - Click "Enable APIs and Services"
   - Search for "Google Drive API"
   - Click "Enable"

3. **Create Service Account:**
   - Go to "IAM & Admin" > "Service Accounts"
   - Click "Create Service Account"
   - Name it (e.g., "rag-drive-sync")
   - Grant "Viewer" role
   - Click "Done"

4. **Generate Key:**
   - Click on created service account
   - Go to "Keys" tab
   - Click "Add Key" > "Create New Key"
   - Choose "JSON"
   - Download the key file

5. **Extract Credentials:**
   - Open downloaded JSON file
   - Copy `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - Copy `private_key` → `GOOGLE_PRIVATE_KEY`

6. **Share Google Drive Folder:**
   - Create a folder in Google Drive
   - Right-click → "Share"
   - Add service account email
   - Grant "Viewer" access
   - Copy folder ID from URL: `https://drive.google.com/drive/folders/[FOLDER_ID]`

### Azure Translator Setup (NEW)

**Prerequisites:**
1. Azure subscription
2. Translator resource created

**Setup Steps:**

1. **Create Translator Resource:**
   - Go to Azure Portal
   - Search for "Translator"
   - Click "Create"
   - Choose resource group, region (East US)
   - Choose pricing tier (F0 for free, S1 for production)
   - Click "Create"

2. **Get Credentials:**
   - Go to resource
   - Click "Keys and Endpoint"
   - Copy KEY 1 → `AZURE_TRANSLATOR_KEY`
   - Copy Location/Region → `AZURE_TRANSLATOR_REGION`
   - Endpoint is standard: `https://api.cognitive.microsofttranslator.com`

**Pricing:**
- Free Tier (F0): 2 million characters per month
- Standard (S1): $10 per 1 million characters

### Azure Search Index Configuration

The Azure AI Search index must be configured with the following schema:

**Fields:**
- `id` (String, Key, Filterable)
- `content` (String, Searchable)
- `contentVector` (Collection of Single, Dimensions: 1536, Searchable)
- `fileName` (String, Filterable, Searchable)
- `fileType` (String, Filterable)
- `language` (String, Filterable)
- `uploadDate` (DateTimeOffset, Filterable, Sortable)
- `metadata` (String, Filterable)

**Vector Search Configuration:**
- Algorithm: HNSW (Hierarchical Navigable Small World)
- Metric: Cosine similarity
- Dimensions: 1536

**Index Creation:**

Use Azure Portal or Azure CLI to create the index with the above schema. The application expects this index to already exist.

---

## Deployment

### Prerequisites

1. **Node.js 18+** installed
2. **FFmpeg** installed and in system PATH
3. **Azure Account** with active subscription
4. **Google Cloud Account** for Gemini API and Drive access
5. **Azure Services** provisioned:
   - Storage Account (ragapphr1na3)
   - AI Search service (ragsearche6bg7z)
   - OpenAI service with 2 deployments
   - Document Intelligence service
   - Speech service
   - Translator service (NEW)
6. **Google Drive** folder created and shared with service account

### Installation Steps

1. **Clone Repository:**
```bash
git clone <repository-url>
cd azure-rag-app
```

2. **Install Dependencies:**
```bash
npm install
```

3. **Install FFmpeg:**

**Windows:**
- Download from: https://ffmpeg.org/download.html
- Add to system PATH

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt-get install ffmpeg
```

4. **Configure Environment:**
```bash
cp .env.example .env
# Edit .env with your Azure, Google, and Gemini credentials
```

5. **Set Up Google Drive:**
- Follow "Google Drive Setup" section above
- Add credentials to .env
- Share folder with service account email

6. **Create Azure Search Index:**
- Follow Azure Search Index Configuration section
- Create index with 1536-dimension vector field

7. **Create Azure OpenAI Deployments:**
- Create primary deployment: `text-embedding-ada-002`
- Create backup deployment: `text-embedding-ada-002-backup`
- Both using same model: text-embedding-ada-002

8. **Start Server:**

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

9. **Verify Google Drive Sync:**
- Check console logs for sync status
- Should see: "✅ Sync complete: X files synced"
- Check `.sync-cache.json` file created

### Production Deployment

**Azure App Service Deployment:**

1. Create Azure App Service (Linux, Node 18+)
2. Configure environment variables in App Service settings
3. Deploy code via Git, ZIP, or CI/CD pipeline
4. Ensure FFmpeg is installed in App Service environment
5. Set startup command: `npm start`
6. Configure Google Drive service account credentials
7. Verify `.sync-cache.json` is writable

**Docker Deployment:**

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine
RUN apk add --no-cache ffmpeg
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t azure-rag-app .
docker run -p 3000:3000 --env-file .env -v $(pwd)/.sync-cache.json:/app/.sync-cache.json azure-rag-app
```

**Note:** Mount `.sync-cache.json` as volume to persist cache between container restarts.

### Health Monitoring

Monitor the following:
- Server response times
- Azure service availability
- Error rates in logs
- Storage and search quota usage
- API rate limits (Gemini, Azure OpenAI)
- Google Drive API quota (10,000 requests/day)
- Translation API usage
- Dual deployment failover events

---

## Performance Considerations

### Expected Processing Times (UPDATED)

| Operation | File Size | Expected Time |
|-----------|-----------|---------------|
| PDF Upload | 1 MB | 5-10 seconds |
| Video Upload | 50 MB | 30-60 seconds |
| Image Upload | 2 MB | 5-8 seconds |
| Simple Query | N/A | 2-5 seconds |
| Complex Query | N/A | 5-10 seconds |
| Google Drive Sync (first time) | 29 files | 6-7 minutes |
| Google Drive Sync (incremental) | 2 new files | 30-60 seconds |
| Translation (document) | 5000 chars | 1-2 seconds |
| Translation (answer) | 500 chars | 0.5-1 seconds |

### Optimization Tips

1. **Chunk Size Optimization:**
   - Smaller chunks (500 words): Better precision, more API calls
   - Larger chunks (2000 words): Fewer API calls, less precision
   - Current: 1000 words is optimal balance

2. **Video Processing:**
   - Adjust frame extraction rate (currently 1 per 5 seconds)
   - Limit max frames processed (currently 10)
   - Balance between quality and speed

3. **Concurrent Requests:**
   - System supports concurrent uploads/queries
   - Azure services handle parallel processing
   - Dual deployment handles load balancing
   - Monitor rate limits

4. **Caching:**
   - Google Drive sync cache prevents re-processing
   - Consider caching frequent queries
   - Cache embeddings for repeated uploads
   - Use Azure Redis Cache for production

5. **Translation Optimization:**
   - Batch translations when possible
   - Cache common translations
   - Skip translation for English content

6. **Dual Deployment:**
   - Automatically load balances between deployments
   - No manual optimization needed
   - Handles 2× capacity automatically

---

## Security Considerations

### API Security

1. **Environment Variables:**
   - Never commit .env file to repository
   - Use Azure Key Vault for production secrets
   - Rotate keys regularly
   - Especially important for Google service account keys

2. **Input Validation:**
   - Validate file types before processing
   - Sanitize user input in queries
   - Limit file upload sizes (currently unlimited)
   - Validate translation inputs

3. **CORS Configuration:**
   - Currently allows all origins (development)
   - Restrict to specific domains in production

4. **Rate Limiting:**
   - Implement rate limiting for API endpoints
   - Prevent abuse and DDoS attacks
   - Monitor Google Drive API quotas

### Data Security

1. **Azure Services:**
   - All data encrypted at rest and in transit
   - Use Azure Private Link for service connections
   - Enable Azure Storage firewall rules

2. **Document Storage:**
   - Files stored in Azure Blob Storage
   - Access controlled via SAS tokens
   - Consider data retention policies
   - Google Drive files accessed read-only

3. **Search Index:**
   - Data indexed in Azure AI Search
   - Access controlled via API keys
   - Consider row-level security for multi-tenant scenarios

4. **Google Drive Security:**
   - Service account has read-only access
   - Limited to specific folder
   - No write or delete permissions
   - Audit service account activity

5. **Translation Security:**
   - Translation API uses HTTPS
   - No data stored by Azure Translator
   - Complies with data privacy regulations

---

## Advanced Features

### Multi-Language Document Processing

**How it works:**
1. Document uploaded (any language)
2. Language automatically detected
3. Document translated to English for indexing
4. Original language stored in metadata
5. Search performed in English (consistent results)
6. Answers translated back to user's language

**Benefits:**
-  Consistent search across all languages
-  Better search quality (English embeddings optimized)
-  Users can ask in any language
-  Documents in any language

### Intelligent File Filtering

**How it works:**
1. User mentions specific file in question
2. System extracts file name using patterns
3. Fuzzy matching finds similar file names (70% threshold)
4. Search results filtered to only that file
5. Improves answer precision

**Patterns recognized:**
- "explain about X.pdf"
- "what is in document Y"
- "tell me about file Z"
- "the content in ABC.docx"
- Works with partial file names

### Dual Deployment Load Balancing

**How it works:**
1. Two Azure OpenAI deployments configured
2. Requests alternate between deployments
3. If one hits rate limit, switches to other
4. If both hit rate limit, waits 60s and retries
5. Transparent to application logic

**Benefits:**
-  2× capacity (240K tokens/min)
-  Zero downtime from rate limits
-  Automatic failover
-  Better resource utilization

### Smart Caching System

**How it works:**
1. `.sync-cache.json` stores file metadata
2. Tracks file ID, name, modified time, processing status
3. On sync, compares with current Drive state
4. Only processes new or modified files
5. Significantly faster server restarts

**Cache structure:**
```json
{
  "file123": {
    "name": "document.pdf",
    "modifiedTime": "2025-11-28T10:00:00Z",
    "indexed": true,
    "chunks": 5,
    "language": "zh",
    "translatedToEnglish": true
  }
}
```

---

## API Response Examples

### Successful Upload (Multi-language Document)

```json
{
  "success": true,
  "message": "Document uploaded and processed successfully",
  "document": {
    "id": "abc123-def456",
    "fileName": "维护指南.pdf",
    "fileType": "application/pdf",
    "language": "english",
    "originalLanguage": "zh",
    "translatedToEnglish": true,
    "chunks": 5,
    "uploadDate": "2025-11-28T10:00:00.000Z",
    "source": "google_drive"
  }
}
```

### Query with Translation

```json
{
  "success": true,
  "question": "如何清洁打印头?",
  "questionInEnglish": "How to clean the print head?",
  "detectedLanguage": "zh",
  "answer": "根据维护指南，清洁打印头的步骤：\n1. 使用提供的清洁溶液...",
  "answerInEnglish": "According to the maintenance guide, steps to clean the print head:\n1. Use the provided cleaning solution...",
  "sources": [
    {
      "fileName": "维护指南.pdf",
      "content": "The print head should be cleaned monthly...",
      "score": 0.92,
      "language": "english",
      "originalLanguage": "zh"
    }
  ],
  "translated": true,
  "usedGemini": true,
  "model": "gemini-2.5-flash",
  "timestamp": "2025-11-28T10:05:00.000Z"
}
```

### Query with File Filtering

```json
{
  "success": true,
  "question": "Can you explain the content in Blanket TDS.pdf?",
  "detectedFile": "Blanket TDS.pdf",
  "specificFileFiltered": true,
  "answer": "The Blanket TDS.pdf is a Technical Data Sheet for...",
  "sources": [
    {
      "fileName": "Blanket TDS.pdf",
      "content": "HP Indigo Image Transfer Blanket...",
      "score": 0.89
    },
    {
      "fileName": "Blanket TDS.pdf",
      "content": "Technical specifications include...",
      "score": 0.87
    }
  ],
  "totalSourcesFound": 2,
  "filteredFrom": 10,
  "usedGemini": true,
  "timestamp": "2025-11-28T10:10:00.000Z"
}
```

### Google Drive Sync Response

```json
{
  "success": true,
  "message": "Sync completed successfully",
  "stats": {
    "totalFiles": 29,
    "newFiles": 2,
    "modifiedFiles": 1,
    "skippedFiles": 26,
    "failedFiles": 0,
    "processedSuccessfully": 3,
    "translatedDocuments": 1,
    "languages": ["en", "zh", "es"]
  },
  "processedFiles": [
    {
      "name": "new-document.pdf",
      "status": "success",
      "language": "en",
      "chunks": 3
    },
    {
      "name": "中文文档.pdf",
      "status": "success",
      "language": "zh",
      "translatedToEnglish": true,
      "chunks": 5
    }
  ],
  "timestamp": "2025-11-28T10:15:00.000Z"
}
```

---

## Support and Maintenance

### Regular Maintenance Tasks

1. **Monitor Azure Services:**
   - Check service health in Azure Portal
   - Review billing and quota usage
   - Monitor API rate limits (especially dual deployments)
   - Check translator usage vs free tier limit

2. **Monitor Google Drive:**
   - Check sync logs for errors
   - Verify `.sync-cache.json` integrity
   - Monitor Google Drive API quotas (10,000 requests/day)
   - Audit service account access

3. **Update Dependencies:**
```bash
npm audit
npm update
```

4. **Review Logs:**
   - Check for recurring errors
   - Monitor performance metrics
   - Analyze query patterns
   - Check translation quality
   - Monitor dual deployment failover events

5. **Backup:**
   - Azure Blob Storage has built-in redundancy
   - Export Azure Search index periodically
   - Backup .env configuration
   - Backup .sync-cache.json
   - Google Drive files are automatically backed up

6. **Cache Maintenance:**
   - Review `.sync-cache.json` size (should be small)
   - Clear cache if corrupted
   - Verify cache accuracy periodically

### Performance Monitoring

**Key Metrics:**
- Average query response time
- Translation time per request
- Embedding generation time
- Google Drive sync duration
- Rate limit hits (should be zero with dual deployment)
- Cache hit rate
- File processing success rate

**Alerts to Configure:**
- Azure service health status
- Rate limit exceeded (both deployments)
- Google Drive API quota exceeded
- Translation API errors
- Server error rate >5%
- Sync failures

### Version Updates

**Node.js Packages:**
- Review release notes before updating
- Test in development environment
- Update lock file: `npm install`

**Azure Services:**
- Monitor Azure service updates
- Review breaking changes
- Test new API versions
- Update client libraries

**Google APIs:**
- Monitor Google Cloud release notes
- Update googleapis library
- Test Drive API changes

---

## Migration Guide

### From Old Version (No Google Drive)

If upgrading from version without Google Drive integration:

1. **Install New Dependencies:**
```bash
npm install googleapis
```

2. **Add Environment Variables:**
```env
GOOGLE_DRIVE_FOLDER_ID=your_folder_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_email
GOOGLE_PRIVATE_KEY="your_key"
AZURE_TRANSLATOR_KEY=your_key
AZURE_TRANSLATOR_ENDPOINT=https://api.cognitive.microsofttranslator.com
AZURE_TRANSLATOR_REGION=eastus
AZURE_OPENAI_EMBEDDING_DEPLOYMENT_BACKUP=text-embedding-ada-002-backup
```

3. **Create Backup Deployment:**
- Go to Azure OpenAI resource
- Create second deployment: `text-embedding-ada-002-backup`

4. **Set Up Google Drive:**
- Follow Google Drive Setup section
- Share folder with service account

5. **Test Sync:**
```bash
npm run dev
# Watch for sync logs
```

6. **Verify Translation:**
```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"question": "测试中文"}'
```

### Existing Documents

Existing documents will continue to work. To benefit from new features:

1. **Re-index with Translation:**
   - Delete all documents: `DELETE /api/documents`
   - Delete `.sync-cache.json`
   - Restart server (auto-sync will re-process)

2. **Or Keep Current Index:**
   - New features work with existing documents
   - Only new uploads get translation
   - Queries work in any language

---

### Version 1.0 (October 2025)

**Initial Features:**
- Basic document upload and processing
- PDF, DOCX, XLSX, Image, Video support
- Azure OpenAI embeddings
- Azure AI Search indexing
- Gemini answer generation
- REST API endpoints

---

## License

This project is proprietary software. All rights reserved.

---
