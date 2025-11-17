# Azure RAG Document Intelligence App

A production-ready Retrieval-Augmented Generation (RAG) system powered by Azure OpenAI, Azure AI Search, Azure Blob Storage, and Azure Document Intelligence.

This application allows users to upload PDFs, extract text, generate embeddings, index the content, and ask natural-language questions with accurate, citation-based answers.

## Features

 * PDF Upload to Azure Blob Storage

 * Text Extraction via Azure Document Intelligence

 * Smart Chunking for long documents

 * Embedding Generation using Azure OpenAI

 * Vector Search powered by Azure AI Search

 * RAG Answer Generation with GPT-4o

 * Citations showing which chunks were used

 * Optional Bing Web Search Fallback

 * All data stays inside your Azure subscription

 ## Architecture
 ```
PDF Upload → Blob Storage
              ↓
    Azure Document Intelligence
              ↓
     Text Chunking → Embeddings
              ↓
     Azure AI Search (Vector Index)
              ↓
          RAG Engine (GPT-4o)
              ↓
 Answer + Sources (JSON Response)
```

##  Project Structure
```
src/
 ├─ config/
 │   └─ azureClients.js
 ├─ services/
 │   ├─ documentProcessor.js
 │   ├─ embeddingService.js
 │   ├─ searchService.js
 │   ├─ ragService.js
 │   └─ webSearchService.js
 ├─ routes/
 │   ├─ documentRoutes.js
 │   └─ queryRoutes.js
 └─ server.js

scripts/
 └─ initIndex.js

.env.example
README.md
package.json
```

## Prerequisites

You need:

* Node.js 18+

* An Azure subscription with:

- Azure OpenAI

- Azure Blob Storage

- Azure AI Search (vector enabled)

- Azure Document Intelligence

* (Optional) Bing Search API key

## Setup Instructions
### Clone the repository
```
git clone https://github.com/your-repo/azure-rag-app.git
cd azure-rag-app
```

### Install dependencies
```
npm install
```

### Configure environment variables

Create a .env file:
```
# Azure Storage
AZURE_STORAGE_CONNECTION_STRING=
STORAGE_CONTAINER_NAME=documents

# Azure OpenAI
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-small

# Azure Search
AZURE_SEARCH_ENDPOINT=
AZURE_SEARCH_API_KEY=
AZURE_SEARCH_INDEX_NAME=documents-index

# Document Intelligence
AZURE_DOC_INTELLIGENCE_ENDPOINT=
AZURE_DOC_INTELLIGENCE_KEY=

# Optional Bing Search
BING_SEARCH_API_KEY=
BING_SEARCH_ENDPOINT=https://api.bing.microsoft.com/v7.0/search

# Server Config
PORT=3000
NODE_ENV=development
```

### Create the search index
```
node scripts/initIndex.js
```

### Run the server
```
npm run dev
```

## API Endpoints
1. Upload a PDF
```
POST /api/upload
```
Form-Data:

Key - file
Type - File
Description - PDF file to upload

2. Query the knowledge base
```
POST /api/query
```

JSON Body:
```
{
  "query": "What is inside this PDF?",
  "language": "english"
}
```

## Example Response
```
{
  "success": true,
  "question": "What is this PDF about?",
  "answer": "The PDF describes multiple AI-based approaches...",
  "sources": [
    {
      "id": "file-chunk-0",
      "fileName": "test.pdf",
      "score": 0.03
    }
  ],
  "usedInternetSearch": false,
  "language": "english",
  "timestamp": "2025-11-17T18:02:59.448Z"
}
```

## Security Notes

* All processing is done inside your Azure environment

* No data leaks to public OpenAI APIs

* Azure OpenAI handles all LLM operations in a secure environment

* Blob Storage and Search keys are never exposed in the client

## Testing

You can test this project using:

* Postman

* Thunder Client (VS Code)

* curl

* Your own frontend

## License

This project is delivered as part of a client engagement.
You may modify and deploy as required.