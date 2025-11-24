# Azure RAG Application - Complete Documentation

---

## Overview

This is an enterprise-grade Retrieval-Augmented Generation (RAG) application built on Microsoft Azure infrastructure. The system enables intelligent document processing and querying across multiple file formats including videos, PDFs, Word documents, Excel spreadsheets, and images.

### Key Capabilities

- **Multi-format Document Processing**: Supports PDF, DOCX, XLSX, PNG, JPG, and MP4 files
- **Video Intelligence**: Extracts both audio transcription and visual content through OCR
- **Semantic Search**: Vector-based similarity search using Azure AI Search
- **Intelligent Answering**: Powered by Google Gemini 2.5 Flash for advanced reasoning
- **Scalable Architecture**: Built on Azure cloud services for enterprise reliability

### Use Cases

- Enterprise document management and search
- Video content analysis and transcription
- Knowledge base query systems
- Document comparison and analysis
- Multi-language content processing

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT APPLICATION                       │
│              (cURL, Postman, Frontend App)                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ HTTP REST API
                     │
┌────────────────────▼────────────────────────────────────────┐
│                   EXPRESS.JS SERVER                          │
│                    (Port 3000)                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Routes: /api/documents, /api/query                  │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
┌──────────────┬──────────────┬──────────────┐
│  Document    │   Search     │     RAG      │
│  Processor   │   Service    │   Service    │
└──────┬───────┴──────┬───────┴──────┬───────┘
       │              │              │
       │              │              │
┌──────▼──────────────▼──────────────▼───────────────────────┐
│               AZURE CLOUD SERVICES                           │
│  ┌──────────────┬──────────────┬───────────────────────┐  │
│  │ Blob Storage │  AI Search   │  Document Intelligence│  │
│  │ (Files)      │ (Vectors)    │  (OCR)                │  │
│  └──────────────┴──────────────┴───────────────────────┘  │
│  ┌──────────────┬──────────────┐                          │
│  │ OpenAI       │ Speech       │                          │
│  │ (Embeddings) │ (Audio STT)  │                          │
│  └──────────────┴──────────────┘                          │
└──────────────────────────────────────────────────────────────┘
                     │
                     │
┌────────────────────▼────────────────────────────────────────┐
│              GOOGLE GEMINI 2.5 FLASH                         │
│              (Answer Generation)                             │
└──────────────────────────────────────────────────────────────┘
```

### Data Flow

#### Upload Flow

1. Client sends file via HTTP POST
2. Express server receives and validates file
3. Document Processor extracts content based on file type
4. Embedding Service generates vector embeddings (1536 dimensions)
5. Search Service indexes content in Azure AI Search
6. Response returned to client

#### Query Flow

1. Client sends question via HTTP POST
2. Embedding Service generates query vector
3. Search Service performs vector similarity search
4. Relevant documents retrieved from Azure AI Search
5. RAG Service sends context + question to Gemini
6. Gemini generates intelligent answer
7. Response with answer and sources returned to client

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
| **Azure Blob Storage** | File storage | Container: documents |
| **Azure AI Search** | Vector search & indexing | Index: documents-index, Dimension: 1536 |
| **Azure OpenAI** | Embedding generation | Model: text-embedding-ada-002 |
| **Azure Document Intelligence** | OCR for PDFs and images | Prebuilt document model |
| **Azure Speech Service** | Video audio transcription | REST API, Region: East US |

### External Services

| Service | Purpose | Model |
|---------|---------|-------|
| **Google Gemini** | Answer generation | gemini-2.5-flash |

### Key Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| `@azure/storage-blob` | Latest | Blob storage operations |
| `@azure/search-documents` | Latest | Search indexing and querying |
| `@azure/openai` | Latest | Embedding generation |
| `@azure/ai-form-recognizer` | Latest | Document intelligence |
| `@google/generative-ai` | Latest | Gemini API client |
| `multer` | 1.4.x | File upload handling |
| `mammoth` | Latest | DOCX processing |
| `xlsx` | Latest | Excel file processing |
| `ffmpeg` | System | Video processing |

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

#### 2. Query Documents

**Endpoint:** `POST /api/query`

**Description:** Ask questions about your uploaded documents

**cURL Example:**

```bash
# Simple query
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What files have been uploaded?"
  }'

# Query with language parameter
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is in my documents?",
    "language": "english"
  }'

# Complex how-to query
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "How do I add a new sheet to my Excel file?"
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
  "language": "string (optional, default: 'english')"
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
        "pageCount": 10
      }
    }
  ],
  "usedInternetSearch": false,
  "usedGemini": true,
  "model": "gemini-2.5-flash",
  "language": "english",
  "timestamp": "2025-11-24T15:35:00.000Z"
}
```

**Status Codes:**
- `200`: Success
- `400`: Missing or invalid question
- `500`: Server error during processing

---

#### 3. Batch Query

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

#### 4. List Documents

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
  "count": 5,
  "documents": [
    {
      "fileName": "document.pdf",
      "fileType": "application/pdf",
      "uploadDate": "2025-11-24T15:30:00.000Z",
      "language": "english"
    },
    {
      "fileName": "spreadsheet.xlsx",
      "fileType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "uploadDate": "2025-11-24T15:32:00.000Z",
      "language": "english"
    }
  ]
}
```

---

#### 5. Delete Document

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

### Postman Collection Setup

To create a complete Postman collection:

1. **Create New Collection:**
   - Click "New" > "Collection"
   - Name it "Azure RAG API"

2. **Add Requests:**
   - Add all 5 endpoints described above
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
│   │   └── queryRoutes.js           # Query endpoints
│   │
│   ├── services/
│   │   ├── documentProcessor.js     # Multi-format document processing
│   │   ├── embeddingService.js      # Vector embedding generation
│   │   ├── searchService.js         # Azure Search operations
│   │   ├── ragService.js            # RAG query processing
│   │   └── webSearchService.js      # Internet search fallback (optional)
│   │
│   └── server.js                    # Express server entry point
│
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
- Register API routes
- Start HTTP server on port 3000

**Key Code:**
```javascript
import express from 'express';
import cors from 'cors';
import multer from 'multer';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());
app.use('/api/documents', documentRouter);
app.use('/api/query', queryRouter);

app.listen(3000);
```

---

### 2. config/azureClients.js

**Purpose:** Centralized Azure service client initialization

**Key Responsibilities:**
- Initialize Azure Blob Storage client
- Initialize Azure AI Search client
- Initialize Azure OpenAI client
- Initialize Azure Document Intelligence client
- Export configured clients for use across services

**Services Configured:**
- BlobServiceClient for file storage
- SearchClient for vector search
- OpenAIClient for embeddings
- DocumentAnalysisClient for OCR

---

### 3. routes/documentRoutes.js

**Purpose:** Handle document upload and management endpoints

**Endpoints:**
- `POST /api/documents/upload` - Upload and process new document
- `GET /api/documents` - List all documents
- `DELETE /api/documents/:filename` - Delete specific document

**Key Responsibilities:**
- Receive file uploads via Multer
- Validate file types
- Call documentProcessor to extract content
- Call embeddingService to generate vectors
- Call searchService to index content
- Handle errors and return responses

**Processing Flow:**
```
File Upload
    → Validate file type
    → Extract content (documentProcessor)
    → Chunk text
    → Generate embeddings (embeddingService)
    → Index in Azure Search (searchService)
    → Return success response
```

---

### 4. routes/queryRoutes.js

**Purpose:** Handle query endpoints for asking questions

**Endpoints:**
- `POST /api/query` - Single question query
- `POST /api/query/batch` - Multiple questions query

**Key Responsibilities:**
- Validate incoming questions
- Call ragService to process query
- Handle optional translation
- Return structured responses with sources

**Query Flow:**
```
Question Received
    → Validate input
    → Generate answer (ragService)
    → Translate if needed
    → Return answer with sources
```

---

### 5. services/documentProcessor.js

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

**`detectLanguage(text)`**
- Detects document language using pattern matching
- Supports: English, Spanish, French, German, Chinese, Arabic, Russian
- Defaults to English if detection fails

---

### 6. services/embeddingService.js

**Purpose:** Generate vector embeddings for semantic search

**Key Method:**

**`generateEmbeddings(texts)`**
- Accepts array of text strings
- Calls Azure OpenAI text-embedding-ada-002 model
- Returns array of 1536-dimensional vectors
- Each vector represents semantic meaning of input text

**Technical Details:**
- Model: text-embedding-ada-002
- Dimension: 1536 (matches Azure Search index configuration)
- Cost: approximately $0.0001 per 1000 tokens

**Why 1536 Dimensions:**
- Standard for OpenAI ada-002 model
- Pre-configured in Azure AI Search index
- Provides good balance of accuracy and performance

**Note:** While Gemini is used for answer generation, Azure OpenAI embeddings are used for search to match the existing index configuration (1536 dimensions).

---

### 7. services/searchService.js

**Purpose:** Interface with Azure AI Search for indexing and querying

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
- Metadata stored as JSON string (Azure requirement)

**Index Schema:**
```javascript
{
  id: "unique-chunk-id",
  content: "text content",
  contentVector: [1536 float values],
  fileName: "document.pdf",
  fileType: "application/pdf",
  language: "english",
  uploadDate: "ISO timestamp",
  metadata: "JSON string with chunk info"
}
```

**`deleteDocumentsByFileName(fileName)`**
- Removes all chunks for a specific file
- Cleans up both content and vectors

**`getAllDocuments()`**
- Returns list of all indexed documents
- Deduplicates by filename
- Includes upload dates and file types

---

### 8. services/ragService.js

**Purpose:** Retrieval-Augmented Generation query processing

**Key Method:**

**`generateAnswer(question, language)`**

**Process:**

1. **Embedding Generation:**
   - Convert question to 1536-dim vector using Azure OpenAI

2. **Retrieval:**
   - Search Azure AI Search for top 5 relevant chunks
   - Ranked by vector similarity

3. **Context Building:**
   - Combine retrieved chunks into context
   - Include source attribution

4. **Answer Generation:**
   - Send context + question to Google Gemini 2.5 Flash
   - Gemini generates intelligent, contextual answer

5. **Response Formatting:**
   - Return answer with source citations
   - Include metadata (model used, sources, scores)

**Why Gemini for Answers:**
- Superior reasoning capabilities
- Better at "how-to" questions
- Provides step-by-step guidance
- Free tier available
- Handles complex queries effectively

**Answer Quality Features:**
- Context-aware responses
- References actual documents
- Provides practical guidance
- Includes code examples when relevant
- Separates document content from general knowledge

**`generateAnswerWithGemini(question, context, language)`**
- Core answer generation logic
- Constructs detailed prompt for Gemini
- Handles response parsing
- Includes fallback error handling

**Prompt Engineering:**
The system uses carefully crafted prompts that instruct Gemini to:
- Answer based on provided context
- Provide step-by-step instructions for "how-to" questions
- Include code examples for technical queries
- Be honest about information not in documents
- Format responses clearly with sections and bullet points

---

### 9. services/webSearchService.js (Optional)

**Purpose:** Internet search fallback when documents do not contain answer

**Key Method:**

**`searchWeb(query)`**
- Falls back to Bing Search API when needed
- Supplements document knowledge with web search
- Currently configured but not actively used

**Note:** This is an optional feature that can be enabled if needed for queries that extend beyond uploaded documents.

---

## Processing Pipeline

### Document Upload Pipeline

```
1. File Upload (Multer)
   |
   v
2. Blob Storage
   - Upload to Azure Blob Storage
   - Get blob URL
   |
   v
3. Content Extraction (documentProcessor)
   - PDF/Image: Azure Document Intelligence (OCR)
   - DOCX: Mammoth library
   - XLSX: SheetJS library
   - Video: FFmpeg + Azure Speech + Azure Doc Intel
   |
   v
4. Text Chunking
   - Split into 1000-word chunks
   - 200-word overlap between chunks
   - Preserve context
   |
   v
5. Embedding Generation (embeddingService)
   - Azure OpenAI text-embedding-ada-002
   - Generate 1536-dim vectors
   - One vector per chunk
   |
   v
6. Indexing (searchService)
   - Store in Azure AI Search
   - Index: content + vector + metadata
   - Enable vector similarity search
   |
   v
7. Response
   - Return success status
   - Include document metadata
```

### Query Processing Pipeline

```
1. Question Received
   |
   v
2. Embedding Generation (embeddingService)
   - Convert question to 1536-dim vector
   - Same model as document embeddings
   |
   v
3. Vector Search (searchService)
   - Search Azure AI Search
   - Find top 5 similar chunks
   - Rank by cosine similarity
   |
   v
4. Context Building (ragService)
   - Combine retrieved chunks
   - Format with source attribution
   - Prepare context for Gemini
   |
   v
5. Answer Generation (ragService)
   - Send to Google Gemini 2.5 Flash
   - Gemini analyzes context + question
   - Generates intelligent answer
   |
   v
6. Response Formatting
   - Structure answer
   - Include source citations
   - Add metadata (scores, model info)
   |
   v
7. Return to Client
   - JSON response with answer
   - Source documents
   - Relevance scores
```

---

## Configuration

### Environment Variables

The application requires the following environment variables in `.env` file:

```bash
# Azure Storage
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;...
STORAGE_CONTAINER_NAME=documents

# Azure OpenAI (for embeddings)
AZURE_OPENAI_ENDPOINT=https://eastus.api.cognitive.microsoft.com/
AZURE_OPENAI_API_KEY=your_key_here
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-ada-002

# Google Gemini (for answers)
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash

# Azure AI Search
AZURE_SEARCH_ENDPOINT=https://your-search.search.windows.net
AZURE_SEARCH_API_KEY=your_key_here
AZURE_SEARCH_INDEX_NAME=documents-index

# Azure Document Intelligence
AZURE_DOC_INTELLIGENCE_ENDPOINT=https://eastus.api.cognitive.microsoft.com/
AZURE_DOC_INTELLIGENCE_KEY=your_key_here

# Azure Speech Service (for video transcription)
AZURE_SPEECH_KEY=your_key_here
AZURE_SPEECH_REGION=eastus

# Server Configuration
PORT=3000
NODE_ENV=development
```

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
4. **Google Cloud Account** for Gemini API
5. **Azure Services** provisioned:
   - Storage Account
   - AI Search service
   - OpenAI service
   - Document Intelligence service
   - Speech service

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
# Edit .env with your Azure and Gemini credentials
```

5. **Create Azure Search Index:**
- Follow Azure Search Index Configuration section
- Create index with 1536-dimension vector field

6. **Start Server:**

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

### Production Deployment

**Azure App Service Deployment:**

1. Create Azure App Service (Linux, Node 18+)
2. Configure environment variables in App Service settings
3. Deploy code via Git, ZIP, or CI/CD pipeline
4. Ensure FFmpeg is installed in App Service environment
5. Set startup command: `npm start`

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
docker run -p 3000:3000 --env-file .env azure-rag-app
```

### Health Monitoring

Monitor the following:
- Server response times
- Azure service availability
- Error rates in logs
- Storage and search quota usage
- API rate limits (Gemini)


---

## Performance Considerations

### Expected Processing Times

| Operation | File Size | Expected Time |
|-----------|-----------|---------------|
| PDF Upload | 1 MB | 5-10 seconds |
| Video Upload | 50 MB | 30-60 seconds |
| Image Upload | 2 MB | 5-8 seconds |
| Simple Query | N/A | 2-5 seconds |
| Complex Query | N/A | 5-10 seconds |

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
   - Monitor rate limits

4. **Caching:**
   - Consider caching frequent queries
   - Cache embeddings for repeated uploads
   - Use Azure Redis Cache for production

---

## Security Considerations

### API Security

1. **Environment Variables:**
   - Never commit .env file to repository
   - Use Azure Key Vault for production secrets
   - Rotate keys regularly

2. **Input Validation:**
   - Validate file types before processing
   - Sanitize user input in queries
   - Limit file upload sizes (currently unlimited)

3. **CORS Configuration:**
   - Currently allows all origins (development)
   - Restrict to specific domains in production

4. **Rate Limiting:**
   - Implement rate limiting for API endpoints
   - Prevent abuse and DDoS attacks

### Data Security

1. **Azure Services:**
   - All data encrypted at rest and in transit
   - Use Azure Private Link for service connections
   - Enable Azure Storage firewall rules

2. **Document Storage:**
   - Files stored in Azure Blob Storage
   - Access controlled via SAS tokens
   - Consider data retention policies

3. **Search Index:**
   - Data indexed in Azure AI Search
   - Access controlled via API keys
   - Consider row-level security for multi-tenant scenarios

---

## Support and Maintenance

### Regular Maintenance Tasks

1. **Monitor Azure Services:**
   - Check service health in Azure Portal
   - Review billing and quota usage
   - Monitor API rate limits

2. **Update Dependencies:**
```bash
npm audit
npm update
```

3. **Review Logs:**
   - Check for recurring errors
   - Monitor performance metrics
   - Analyze query patterns

4. **Backup:**
   - Azure Blob Storage has built-in redundancy
   - Export Azure Search index periodically
   - Backup .env configuration

### Version Updates

**Node.js Packages:**
- Review release notes before updating
- Test in development environment
- Update lock file: `npm install`

**Azure Services:**
- Monitor Azure service updates
- Review breaking changes
- Test new API versions

---

## License

This project is proprietary software. All rights reserved.

---
