# RAG Application - Azure AKS Setup Guide

A step-by-step guide to deploy this RAG (Retrieval-Augmented Generation) application to your Azure Kubernetes Service (AKS) cluster.

---

## Prerequisites

Before starting, ensure you have:

- Azure subscription with appropriate permissions
- Azure CLI installed and logged in (`az login`)
- Docker installed
- kubectl installed
- Git installed

---

## Architecture Overview

This application uses:
- **Azure Container Registry (ACR)** - Docker image storage
- **Azure Kubernetes Service (AKS)** - Container orchestration
- **Azure Key Vault** - Secrets management
- **Azure OpenAI** - Embeddings generation
- **Azure Cognitive Search** - Vector search
- **Azure Document Intelligence** - Document OCR
- **Azure Translator** - Multi-language support
- **Azure Speech Services** - Audio transcription
- **Google Drive API** - Document synchronization
- **Gemini API** - Chat responses

---

## Step 1: Clone the Repository

```bash
git clone <your-repo-url>
cd azure-rag-app
```

---

## Step 2: Create Azure Resources

### 2.1 Set Environment Variables

```bash
# Set your resource group and location
RESOURCE_GROUP="my-rag-rg"
LOCATION="eastus"
AKS_CLUSTER_NAME="my-rag-aks"
ACR_NAME="myragacr$(date +%s)"  # Must be globally unique
KEYVAULT_NAME="my-rag-kv-$(date +%s)"  # Must be globally unique
STORAGE_ACCOUNT="myragstorage$(date +%s)"  # Must be globally unique
```

### 2.2 Create Resource Group

```bash
az group create --name $RESOURCE_GROUP --location $LOCATION
```

### 2.3 Create Azure Container Registry

```bash
az acr create \
  --resource-group $RESOURCE_GROUP \
  --name $ACR_NAME \
  --sku Basic

# Enable admin access
az acr update --name $ACR_NAME --admin-enabled true

# Get ACR credentials
ACR_USERNAME=$(az acr credential show --name $ACR_NAME --query "username" -o tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query "passwords[0].value" -o tsv)
```

### 2.4 Create AKS Cluster

```bash
az aks create \
  --resource-group $RESOURCE_GROUP \
  --name $AKS_CLUSTER_NAME \
  --node-count 2 \
  --node-vm-size Standard_D4s_v3 \
  --enable-managed-identity \
  --attach-acr $ACR_NAME \
  --enable-addons azure-keyvault-secrets-provider \
  --generate-ssh-keys

# Get AKS credentials
az aks get-credentials --resource-group $RESOURCE_GROUP --name $AKS_CLUSTER_NAME
```

### 2.5 Create Azure Key Vault

```bash
az keyvault create \
  --name $KEYVAULT_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION

# Get your user object ID
USER_OBJECT_ID=$(az ad signed-in-user show --query id -o tsv)

# Grant yourself permissions
az keyvault set-policy \
  --name $KEYVAULT_NAME \
  --object-id $USER_OBJECT_ID \
  --secret-permissions get list set delete
```

### 2.6 Create Azure Storage Account

```bash
az storage account create \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS

# Get connection string
STORAGE_CONNECTION=$(az storage account show-connection-string \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --query "connectionString" -o tsv)
```

---

## Step 3: Configure Azure Services

### 3.1 Create Azure OpenAI Resource

```bash
# Create Azure OpenAI
az cognitiveservices account create \
  --name my-rag-openai \
  --resource-group $RESOURCE_GROUP \
  --kind OpenAI \
  --sku S0 \
  --location eastus

# Get endpoint and key
OPENAI_ENDPOINT=$(az cognitiveservices account show \
  --name my-rag-openai \
  --resource-group $RESOURCE_GROUP \
  --query "properties.endpoint" -o tsv)

OPENAI_KEY=$(az cognitiveservices account keys list \
  --name my-rag-openai \
  --resource-group $RESOURCE_GROUP \
  --query "key1" -o tsv)

# Deploy models (via Azure Portal - Models section)
# Deploy: gpt-4o (for chat) as "gpt-4o"
# Deploy: text-embedding-ada-002 (for embeddings) as "text-embedding-ada-002"
```

### 3.2 Create Azure Cognitive Search

```bash
az search service create \
  --name my-rag-search \
  --resource-group $RESOURCE_GROUP \
  --sku basic \
  --location $LOCATION

# Get endpoint and key
SEARCH_ENDPOINT="https://my-rag-search.search.windows.net"
SEARCH_KEY=$(az search admin-key show \
  --service-name my-rag-search \
  --resource-group $RESOURCE_GROUP \
  --query "primaryKey" -o tsv)
```

### 3.3 Create Document Intelligence

```bash
az cognitiveservices account create \
  --name my-rag-doc-intel \
  --resource-group $RESOURCE_GROUP \
  --kind FormRecognizer \
  --sku S0 \
  --location eastus

DOC_INTEL_ENDPOINT=$(az cognitiveservices account show \
  --name my-rag-doc-intel \
  --resource-group $RESOURCE_GROUP \
  --query "properties.endpoint" -o tsv)

DOC_INTEL_KEY=$(az cognitiveservices account keys list \
  --name my-rag-doc-intel \
  --resource-group $RESOURCE_GROUP \
  --query "key1" -o tsv)
```

### 3.4 Create Translator Service

```bash
az cognitiveservices account create \
  --name my-rag-translator \
  --resource-group $RESOURCE_GROUP \
  --kind TextTranslation \
  --sku S1 \
  --location global

TRANSLATOR_KEY=$(az cognitiveservices account keys list \
  --name my-rag-translator \
  --resource-group $RESOURCE_GROUP \
  --query "key1" -o tsv)

TRANSLATOR_ENDPOINT="https://api.cognitive.microsofttranslator.com/"
TRANSLATOR_REGION="global"
```

### 3.5 Create Speech Service

```bash
az cognitiveservices account create \
  --name my-rag-speech \
  --resource-group $RESOURCE_GROUP \
  --kind SpeechServices \
  --sku S0 \
  --location eastus

SPEECH_KEY=$(az cognitiveservices account keys list \
  --name my-rag-speech \
  --resource-group $RESOURCE_GROUP \
  --query "key1" -o tsv)

SPEECH_REGION="eastus"
```

---

## Step 4: Set Up Google Drive API

### 4.1 Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable Google Drive API
4. Go to "APIs & Services" > "Credentials"
5. Create "Service Account"
6. Download the JSON key file
7. Share your Google Drive folder with the service account email

### 4.2 Extract Google Credentials

From the downloaded JSON file, extract:
- `project_id`
- `private_key_id`
- `private_key`
- `client_email`
- `client_id`

### 4.3 Get Your Google Drive Folder ID

1. Open Google Drive
2. Navigate to the folder you want to sync
3. Copy the folder ID from the URL: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`

---

## Step 5: Get Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create an API key
3. Copy the key

---

## Step 6: Store Secrets in Key Vault

```bash
# Azure OpenAI
az keyvault secret set --vault-name $KEYVAULT_NAME --name azure-openai-endpoint --value "$OPENAI_ENDPOINT"
az keyvault secret set --vault-name $KEYVAULT_NAME --name azure-openai-api-key --value "$OPENAI_KEY"
az keyvault secret set --vault-name $KEYVAULT_NAME --name azure-openai-deployment-name --value "gpt-4o"
az keyvault secret set --vault-name $KEYVAULT_NAME --name azure-openai-embedding-deployment --value "text-embedding-ada-002"

# Azure Search
az keyvault secret set --vault-name $KEYVAULT_NAME --name azure-search-endpoint --value "$SEARCH_ENDPOINT"
az keyvault secret set --vault-name $KEYVAULT_NAME --name azure-search-api-key --value "$SEARCH_KEY"
az keyvault secret set --vault-name $KEYVAULT_NAME --name azure-search-index-name --value "rag-documents"

# Document Intelligence
az keyvault secret set --vault-name $KEYVAULT_NAME --name azure-doc-intelligence-endpoint --value "$DOC_INTEL_ENDPOINT"
az keyvault secret set --vault-name $KEYVAULT_NAME --name azure-doc-intelligence-key --value "$DOC_INTEL_KEY"

# Translator
az keyvault secret set --vault-name $KEYVAULT_NAME --name azure-translator-endpoint --value "$TRANSLATOR_ENDPOINT"
az keyvault secret set --vault-name $KEYVAULT_NAME --name azure-translator-key --value "$TRANSLATOR_KEY"
az keyvault secret set --vault-name $KEYVAULT_NAME --name azure-translator-region --value "$TRANSLATOR_REGION"

# Speech
az keyvault secret set --vault-name $KEYVAULT_NAME --name azure-speech-key --value "$SPEECH_KEY"
az keyvault secret set --vault-name $KEYVAULT_NAME --name azure-speech-region --value "$SPEECH_REGION"

# Storage
az keyvault secret set --vault-name $KEYVAULT_NAME --name azure-storage-connection-string --value "$STORAGE_CONNECTION"

# Google Drive (replace with your values)
az keyvault secret set --vault-name $KEYVAULT_NAME --name google-project-id --value "YOUR_PROJECT_ID"
az keyvault secret set --vault-name $KEYVAULT_NAME --name google-private-key-id --value "YOUR_PRIVATE_KEY_ID"
az keyvault secret set --vault-name $KEYVAULT_NAME --name google-private-key --value "YOUR_PRIVATE_KEY"
az keyvault secret set --vault-name $KEYVAULT_NAME --name google-service-account-email --value "YOUR_SERVICE_ACCOUNT_EMAIL"
az keyvault secret set --vault-name $KEYVAULT_NAME --name google-client-id --value "YOUR_CLIENT_ID"
az keyvault secret set --vault-name $KEYVAULT_NAME --name google-drive-folder-id --value "YOUR_FOLDER_ID"

# Gemini API (replace with your key)
az keyvault secret set --vault-name $KEYVAULT_NAME --name gemini-api-key --value "YOUR_GEMINI_API_KEY"
az keyvault secret set --vault-name $KEYVAULT_NAME --name gemini-model --value "gemini-1.5-flash"

# Application settings
az keyvault secret set --vault-name $KEYVAULT_NAME --name node-env --value "production"
az keyvault secret set --vault-name $KEYVAULT_NAME --name port --value "3000"
```

---

## Step 7: Grant AKS Access to Key Vault

```bash
# Get the kubelet managed identity client ID
KUBELET_IDENTITY=$(az aks show \
  --resource-group $RESOURCE_GROUP \
  --name $AKS_CLUSTER_NAME \
  --query "identityProfile.kubeletidentity.clientId" -o tsv)

# Get the kubelet managed identity object ID
KUBELET_OBJECT_ID=$(az aks show \
  --resource-group $RESOURCE_GROUP \
  --name $AKS_CLUSTER_NAME \
  --query "identityProfile.kubeletidentity.objectId" -o tsv)

# Grant Key Vault permissions
az keyvault set-policy \
  --name $KEYVAULT_NAME \
  --object-id $KUBELET_OBJECT_ID \
  --secret-permissions get list
```

---

## Step 8: Build and Push Docker Image

```bash
# Login to ACR
az acr login --name $ACR_NAME

# Build the Docker image
docker build -t $ACR_NAME.azurecr.io/rag-app:v1.0 .

# Push to ACR
docker push $ACR_NAME.azurecr.io/rag-app:v1.0
```

---

## Step 9: Update Kubernetes Manifests (Please Check Readme File in example-k8s directory)

### 9.1 Update `k8s/namespace.yaml`
No changes needed - this creates the `rag-app` namespace.

### 9.2 Update `k8s/secret-provider-class.yaml`

Replace the following values:
- `userAssignedIdentityID`: Use `$KUBELET_IDENTITY` from Step 7
- `keyvaultName`: Use `$KEYVAULT_NAME`
- `tenantId`: Get from `az account show --query tenantId -o tsv`

### 9.3 Update `k8s/pvc.yaml`
No changes needed - this creates persistent storage.

### 9.4 Update `k8s/deployment.yaml`

Replace the image name:
```yaml
image: YOUR_ACR_NAME.azurecr.io/rag-app:v1.0
```

### 9.5 Update `k8s/service.yaml`
No changes needed - this exposes the application.

---

## Step 10: Deploy to AKS

```bash
# Create namespace
kubectl apply -f k8s/namespace.yaml

# Create persistent volume claim
kubectl apply -f k8s/pvc.yaml -n rag-app

# Create secret provider class
kubectl apply -f k8s/secret-provider-class.yaml -n rag-app

# Deploy application
kubectl apply -f k8s/deployment.yaml -n rag-app

# Create service
kubectl apply -f k8s/service.yaml -n rag-app

# Watch pods start
kubectl get pods -n rag-app -w
```

---

## Step 11: Verify Deployment

```bash
# Check pod status
kubectl get pods -n rag-app

# Check pod logs
kubectl logs -n rag-app <POD_NAME>

# Check service
kubectl get svc -n rag-app

# Port forward to test locally
kubectl port-forward -n rag-app svc/rag-app-service 3000:3000
```

Visit `http://localhost:3000` to access the application.

---

## Step 12: (Optional) Set Up Ingress

If you want to expose the application to the internet:

```bash
# Install NGINX Ingress Controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/cloud/deploy.yaml

# Wait for external IP
kubectl get svc -n ingress-nginx

# Create ingress resource (create k8s/ingress.yaml)
kubectl apply -f k8s/ingress.yaml -n rag-app
```

---

## Updating the Application

```bash
# Build new version
docker build -t $ACR_NAME.azurecr.io/rag-app:v1.1 .

# Push to ACR
docker push $ACR_NAME.azurecr.io/rag-app:v1.1

# Update deployment
kubectl set image deployment/rag-app \
  rag-app=$ACR_NAME.azurecr.io/rag-app:v1.1 \
  -n rag-app

# Watch rollout
kubectl rollout status deployment/rag-app -n rag-app
```

---

## Scaling

```bash
# Scale to 3 replicas
kubectl scale deployment rag-app --replicas=3 -n rag-app

# Enable autoscaling
kubectl autoscale deployment rag-app \
  --cpu-percent=70 \
  --min=2 \
  --max=5 \
  -n rag-app
```

---

## Cleanup

To delete all resources:

```bash
# Delete Kubernetes resources
kubectl delete namespace rag-app

# Delete Azure resources
az group delete --name $RESOURCE_GROUP --yes --no-wait
```

---

## Cost Optimization Tips

1. **Use Spot Instances** for AKS nodes (non-production)
2. **Start/Stop AKS cluster** when not in use: `az aks stop` / `az aks start`
3. **Use Azure OpenAI consumption-based pricing** instead of provisioned
4. **Monitor and optimize** Azure Cognitive Search tier based on usage
5. **Set retention policies** on Azure Storage to auto-delete old data

---

## Support

For issues or questions:
1. Check application logs: `kubectl logs -n rag-app <POD_NAME>`
2. Check Kubernetes events: `kubectl get events -n rag-app`
3. Verify all secrets in Key Vault
4. Ensure service account has Google Drive folder access

---

## Architecture Diagram

```
┌─────────────────┐
│  Google Drive   │
│    (Source)     │
└────────┬────────┘
         │
         v
┌─────────────────────────────────────────────┐
│           Azure Kubernetes Service           │
│  ┌──────────────────────────────────────┐   │
│  │     RAG Application Pods (x2)        │   │
│  │  - Document Sync                     │   │
│  │  - OCR Processing                    │   │
│  │  - Speech Transcription              │   │
│  │  - Vector Embeddings                 │   │
│  │  - Query Processing                  │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
         │
         v
┌─────────────────────────────────────────────┐
│         Azure Services (PaaS)                │
│  - Azure OpenAI (Embeddings)                │
│  - Azure Cognitive Search (Vector DB)       │
│  - Azure Document Intelligence (OCR)        │
│  - Azure Translator (Multi-language)        │
│  - Azure Speech (Audio Transcription)       │
│  - Azure Key Vault (Secrets)                │
│  - Azure Container Registry (Images)        │
│  - Azure Storage (Data)                     │
└─────────────────────────────────────────────┘
         │
         v
┌─────────────────┐
│   Gemini API    │
│  (Chat Model)   │
└─────────────────┘
```

---

**Ready to Deploy!** Follow the steps in order and you'll have a fully functional RAG application running on Azure AKS. 🚀