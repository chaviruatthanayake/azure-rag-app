# Azure RAG Application

A production-ready Retrieval-Augmented Generation (RAG) application that syncs documents from Google Drive, processes them using Azure AI services, and enables intelligent multi-language Q&A.

## Features

-  **Google Drive Sync** - Automatic document synchronization
-  **Multi-Language Support** - Ask and answer in 60+ languages
-  **Multi-Format Processing** - PDF, DOCX, XLSX, images, and videos
-  **Video Intelligence** - Extracts both audio and visual content
-  **Semantic Search** - Vector-based document search
-  **AI-Powered Answers** - Google Gemini 2.5 Flash

## Quick Start

### Prerequisites

- Node.js 18+
- FFmpeg installed
- Azure subscription
- Google Cloud account (for Drive + Gemini)

### Installation

```bash
# Clone and install
git clone <repo-url>
cd azure-rag-app
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Start server
npm start
```

Server runs at `http://localhost:3000`

## API Endpoints

### Upload Document
```bash
curl -X POST http://localhost:3000/api/documents/upload \
  -F "file=@document.pdf"
```

### Ask Question
```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What is in my documents?"}'
```

### Sync Google Drive
```bash
curl -X POST http://localhost:3000/api/sync/drive
```

### List Documents
```bash
curl http://localhost:3000/api/documents
```

## Configuration

Create a `.env` file with:

```bash
# Azure Services
AZURE_STORAGE_CONNECTION_STRING=your_connection_string
AZURE_OPENAI_ENDPOINT=your_endpoint
AZURE_OPENAI_API_KEY=your_key
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-ada-002
AZURE_SEARCH_ENDPOINT=your_search_endpoint
AZURE_SEARCH_API_KEY=your_search_key

# Google Services
GEMINI_API_KEY=your_gemini_key
GOOGLE_DRIVE_FOLDER_ID=your_folder_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## Azure Kubernetes Service (AKS) Deployment

This application is designed to run on Azure Kubernetes Service with the following architecture:

### Architecture

- **Container Registry**: Azure Container Registry (ACR) stores Docker images
- **Kubernetes Cluster**: AKS cluster runs 2 replicas for high availability
- **Secrets Management**: Azure Key Vault via CSI driver
- **Storage**: Azure Blob Storage for documents, Persistent Volume for app data
- **Services**: LoadBalancer exposes the application

### Deploy to AKS

See **[SETUP_GUIDE.md](AKS-Setup-Guide.md)** for complete deployment instructions.

**Quick Deploy:**

```bash
# Build and push Docker image
docker build -t your-acr.azurecr.io/rag-app:v1.0 .
docker push your-acr.azurecr.io/rag-app:v1.0

# Deploy to Kubernetes
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/pvc.yaml -n rag-app
kubectl apply -f k8s/secret-provider-class.yaml -n rag-app
kubectl apply -f k8s/deployment.yaml -n rag-app
kubectl apply -f k8s/service.yaml -n rag-app

# Check status
kubectl get pods -n rag-app
```

**Files in `k8s/` directory:**
- `namespace.yaml` - Creates rag-app namespace
- `pvc.yaml` - 10Gi persistent storage
- `secret-provider-class.yaml` - Mounts secrets from Key Vault (update with your values)
- `deployment.yaml` - 2-replica deployment (update image name)
- `service.yaml` - LoadBalancer service
- `ingress.yaml` - Optional external access

**Important**: Update placeholders in `secret-provider-class.yaml` and `deployment.yaml` before deploying.

## Architecture

```
Google Drive → AKS Pod → Azure OpenAI (embeddings)
                      → Azure Search (vector storage)
                      → Gemini (answers)
                      → Azure Translator (multi-language)
```

## Supported File Types

- **Documents**: PDF, DOCX, XLSX
- **Images**: PNG, JPG
- **Videos**: MP4, MOV, AVI

## Development

```bash
# Development mode with auto-reload
npm run dev

# Run tests
npm test

# Build Docker image
docker build -t rag-app .
```

## Project Structure

```
azure-rag-app/
├── src/
│   ├── config/           # Azure client initialization
│   ├── routes/           # API endpoints
│   ├── services/         # Core business logic
│   └── server.js         # Express server
├── k8s/                  # Kubernetes manifests
├── .env                  # Environment variables
├── Dockerfile            # Docker configuration
├── SETUP_GUIDE.md        # Complete deployment guide
└── package.json          # Dependencies
```

## Documentation

- **[k8s/README.md](Readme.md)** - Comprehensive Solution documentation
- **[SETUP_GUIDE.md](AKS-Setup-Guide.md)** - Complete AKS deployment guide
- **[k8s/README.md](example-k8s/Readme.md)** - Kubernetes manifests documentation

## Technologies

- **Runtime**: Node.js 18, Express.js
- **Azure**: OpenAI, Cognitive Search, Document Intelligence, Translator, Speech, Blob Storage, Key Vault
- **Google**: Drive API, Gemini 2.5 Flash
- **Kubernetes**: AKS, Azure Container Registry

## License

Proprietary - All rights reserved