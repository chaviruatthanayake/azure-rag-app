#  Kubernetes Deployment Guide - RAG Application

Complete guide to deploy the RAG application on Azure Kubernetes Service (AKS) with Azure Key Vault integration.

---

##  Prerequisites

### Required Tools
- `kubectl` - Kubernetes CLI
- `az` - Azure CLI
- `docker` - Container runtime
- `jq` - JSON processor (for secret handling)

### Required Access
- Azure subscription with AKS cluster
- Azure Container Registry (ACR)
- Azure Key Vault
- GCP project with enabled APIs:
  - Gemini API
  - Cloud SQL Admin API
  - Google Drive API
  - Cloud Translation API

---

##  Architecture Overview

```
Azure Kubernetes Service (AKS)
├── Namespace: rag-app-gcp
│   ├── Deployment: rag-app (2 replicas)
│   ├── Service: LoadBalancer (External IP)
│   ├── ConfigMap: rag-app-config
│   ├── SecretProviderClass: azure-kv-gcp-secrets
│   └── HPA: Auto-scaling (2-10 pods)
│
├── Azure Key Vault: rag-kv-1764692409
│   └── Secrets: GCP-* (service account, API keys)
│
└── External Dependencies
    ├── Cloud SQL (GCP): PostgreSQL + pgvector
    ├── Google Drive: Document storage
    └── Gemini API: AI/ML services
```

---

##  Step-by-Step Deployment

### Step 1: Prepare Your Environment

```bash
# Set variables
export RESOURCE_GROUP="mcp-rg"
export CLUSTER_NAME="mcp-demo-aks"
export ACR_NAME="ragacr1764692409"
export KEY_VAULT_NAME="rag-kv-1764692409"
export NAMESPACE="rag-app-gcp"

# Login to Azure
az login

# Connect to AKS cluster
az aks get-credentials --resource-group $RESOURCE_GROUP --name $CLUSTER_NAME

# Verify connection
kubectl cluster-info
```

---

### Step 2: Create Namespace

```bash
kubectl create namespace $NAMESPACE
```

---

### Step 3: Add Secrets to Azure Key Vault

#### Get Your GCP Service Account JSON

```bash
# Download from GCP Console or use existing file
# Example: vertex-rag-key.json
```

#### Add Secrets to Key Vault

```bash
# 1. Gemini API Key
az keyvault secret set --vault-name $KEY_VAULT_NAME \
  --name "GCP-gemini-api-key" \
  --value "YOUR_GEMINI_API_KEY"

# 2. Cloud SQL Password
az keyvault secret set --vault-name $KEY_VAULT_NAME \
  --name "GCP-cloud-sql-password" \
  --value "YOUR_CLOUD_SQL_PASSWORD"

# 3. Google Credentials JSON
az keyvault secret set --vault-name $KEY_VAULT_NAME \
  --name "GCP-google-credentials-json" \
  --file ./vertex-rag-key.json

# 4. Google Private Key (with actual newlines, not \n)
cat ./vertex-rag-key.json | jq -r '.private_key' > /tmp/private-key.txt
az keyvault secret set --vault-name $KEY_VAULT_NAME \
  --name "GCP-google-private-key" \
  --file /tmp/private-key.txt

# 5. Google Client Email
az keyvault secret set --vault-name $KEY_VAULT_NAME \
  --name "GCP-google-client-email" \
  --value "$(cat ./vertex-rag-key.json | jq -r '.client_email')"

# 6. Google Project ID
az keyvault secret set --vault-name $KEY_VAULT_NAME \
  --name "GCP-google-project-id" \
  --value "$(cat ./vertex-rag-key.json | jq -r '.project_id')"

# 7. Google Private Key ID
az keyvault secret set --vault-name $KEY_VAULT_NAME \
  --name "GCP-google-private-key-id" \
  --value "$(cat ./vertex-rag-key.json | jq -r '.private_key_id')"

# 8. Google Client ID
az keyvault secret set --vault-name $KEY_VAULT_NAME \
  --name "GCP-google-client-id" \
  --value "$(cat ./vertex-rag-key.json | jq -r '.client_id')"

# Verify secrets
az keyvault secret list --vault-name $KEY_VAULT_NAME \
  --query "[?starts_with(name, 'GCP-')].name" -o table
```

---

### Step 4: Get AKS Identity Information

```bash
# Get Tenant ID
TENANT_ID=$(az account show --query tenantId -o tsv)
echo "Tenant ID: $TENANT_ID"

# Get Kubelet Identity Client ID
IDENTITY_CLIENT_ID=$(az aks show --resource-group $RESOURCE_GROUP --name $CLUSTER_NAME --query "identityProfile.kubeletidentity.clientId" -o tsv)
echo "Identity Client ID: $IDENTITY_CLIENT_ID"

# Grant AKS access to Key Vault
az keyvault set-policy \
  --name $KEY_VAULT_NAME \
  --object-id $(az ad sp show --id $IDENTITY_CLIENT_ID --query id -o tsv) \
  --secret-permissions get list
```

---

### Step 5: Build and Push Docker Image

```bash
# Login to ACR
az acr login --name $ACR_NAME

# Build Docker image
docker build -t $ACR_NAME.azurecr.io/rag-app-gcp:v1.0 .

# Push to ACR
docker push $ACR_NAME.azurecr.io/rag-app-gcp:v1.0

# Verify
az acr repository show --name $ACR_NAME --repository rag-app-gcp
```

---

### Step 6: Create Kubernetes Manifests

#### 6.1: ConfigMap (k8s-configmap.yaml)

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: rag-app-config
  namespace: rag-app-gcp
data:
  NODE_ENV: "production"
  PORT: "3000"
  GCP_PROJECT_ID: "copper-depot-480116-h4"
  GCP_REGION: "us-east4"
  CLOUD_SQL_HOST: "104.198.228.120"
  CLOUD_SQL_PORT: "5432"
  CLOUD_SQL_DATABASE: "ragdb"
  CLOUD_SQL_USER: "raguser"
  GOOGLE_DRIVE_FOLDER_ID: "1i2Iv1sY6VKCvc3uEjmFk0csAvzK4P7bg"
  USE_GCP_SEARCH: "true"
  GCP_TRANSLATION_ENABLED: "true"
```

#### 6.2: SecretProviderClass (k8s-secretproviderclass.yaml)

```yaml
apiVersion: secrets-store.csi.x-k8s.io/v1
kind: SecretProviderClass
metadata:
  name: azure-kv-gcp-secrets
  namespace: rag-app-gcp
spec:
  provider: azure
  parameters:
    usePodIdentity: "false"
    useVMManagedIdentity: "true"
    userAssignedIdentityID: "0680581c-8eaf-475d-8249-ed17be8db1cd"  # Your Identity Client ID
    keyvaultName: "rag-kv-1764692409"
    cloudName: ""
    objects: |
      array:
        - |
          objectName: GCP-gemini-api-key
          objectType: secret
          objectVersion: ""
        - |
          objectName: GCP-cloud-sql-password
          objectType: secret
          objectVersion: ""
        - |
          objectName: GCP-google-credentials-json
          objectType: secret
          objectVersion: ""
        - |
          objectName: GCP-google-private-key
          objectType: secret
          objectVersion: ""
        - |
          objectName: GCP-google-client-email
          objectType: secret
          objectVersion: ""
        - |
          objectName: GCP-google-project-id
          objectType: secret
          objectVersion: ""
        - |
          objectName: GCP-google-private-key-id
          objectType: secret
          objectVersion: ""
        - |
          objectName: GCP-google-client-id
          objectType: secret
          objectVersion: ""
    tenantId: "d33a0658-022e-4e22-997a-e02e7a094b56"  # Your Tenant ID
  secretObjects:
  - secretName: rag-app-secrets-from-kv
    type: Opaque
    data:
    - objectName: GCP-gemini-api-key
      key: GEMINI_API_KEY
    - objectName: GCP-cloud-sql-password
      key: CLOUD_SQL_PASSWORD
    - objectName: GCP-google-credentials-json
      key: GOOGLE_APPLICATION_CREDENTIALS_JSON
    - objectName: GCP-google-private-key
      key: GOOGLE_PRIVATE_KEY
    - objectName: GCP-google-client-email
      key: GOOGLE_CLIENT_EMAIL
    - objectName: GCP-google-project-id
      key: GOOGLE_PROJECT_ID
    - objectName: GCP-google-private-key-id
      key: GOOGLE_PRIVATE_KEY_ID
    - objectName: GCP-google-client-id
      key: GOOGLE_CLIENT_ID
```

#### 6.3: Deployment (k8s-deployment.yaml)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rag-app
  namespace: rag-app-gcp
  labels:
    app: rag-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: rag-app
  template:
    metadata:
      labels:
        app: rag-app
    spec:
      containers:
      - name: rag-app
        image: ragacr1764692409.azurecr.io/rag-app-gcp:v1.0
        ports:
        - containerPort: 3000
          name: http
        env:
        - name: NODE_ENV
          valueFrom:
            configMapKeyRef:
              name: rag-app-config
              key: NODE_ENV
        - name: PORT
          valueFrom:
            configMapKeyRef:
              name: rag-app-config
              key: PORT
        - name: GCP_PROJECT_ID
          valueFrom:
            configMapKeyRef:
              name: rag-app-config
              key: GCP_PROJECT_ID
        - name: GCP_REGION
          valueFrom:
            configMapKeyRef:
              name: rag-app-config
              key: GCP_REGION
        - name: CLOUD_SQL_HOST
          valueFrom:
            configMapKeyRef:
              name: rag-app-config
              key: CLOUD_SQL_HOST
        - name: CLOUD_SQL_PORT
          valueFrom:
            configMapKeyRef:
              name: rag-app-config
              key: CLOUD_SQL_PORT
        - name: CLOUD_SQL_DATABASE
          valueFrom:
            configMapKeyRef:
              name: rag-app-config
              key: CLOUD_SQL_DATABASE
        - name: CLOUD_SQL_USER
          valueFrom:
            configMapKeyRef:
              name: rag-app-config
              key: CLOUD_SQL_USER
        - name: GOOGLE_DRIVE_FOLDER_ID
          valueFrom:
            configMapKeyRef:
              name: rag-app-config
              key: GOOGLE_DRIVE_FOLDER_ID
        - name: USE_GCP_SEARCH
          valueFrom:
            configMapKeyRef:
              name: rag-app-config
              key: USE_GCP_SEARCH
        - name: GCP_TRANSLATION_ENABLED
          valueFrom:
            configMapKeyRef:
              name: rag-app-config
              key: GCP_TRANSLATION_ENABLED
        - name: GEMINI_API_KEY
          valueFrom:
            secretKeyRef:
              name: rag-app-secrets-from-kv
              key: GEMINI_API_KEY
        - name: CLOUD_SQL_PASSWORD
          valueFrom:
            secretKeyRef:
              name: rag-app-secrets-from-kv
              key: CLOUD_SQL_PASSWORD
        - name: GOOGLE_APPLICATION_CREDENTIALS_JSON
          valueFrom:
            secretKeyRef:
              name: rag-app-secrets-from-kv
              key: GOOGLE_APPLICATION_CREDENTIALS_JSON
        - name: GOOGLE_PRIVATE_KEY
          valueFrom:
            secretKeyRef:
              name: rag-app-secrets-from-kv
              key: GOOGLE_PRIVATE_KEY
        - name: GOOGLE_CLIENT_EMAIL
          valueFrom:
            secretKeyRef:
              name: rag-app-secrets-from-kv
              key: GOOGLE_CLIENT_EMAIL
        - name: GOOGLE_PROJECT_ID
          valueFrom:
            secretKeyRef:
              name: rag-app-secrets-from-kv
              key: GOOGLE_PROJECT_ID
        - name: GOOGLE_PRIVATE_KEY_ID
          valueFrom:
            secretKeyRef:
              name: rag-app-secrets-from-kv
              key: GOOGLE_PRIVATE_KEY_ID
        - name: GOOGLE_CLIENT_ID
          valueFrom:
            secretKeyRef:
              name: rag-app-secrets-from-kv
              key: GOOGLE_CLIENT_ID
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1"
        volumeMounts:
        - name: secrets-store
          mountPath: "/mnt/secrets-store"
          readOnly: true
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
      volumes:
      - name: secrets-store
        csi:
          driver: secrets-store.csi.k8s.io
          readOnly: true
          volumeAttributes:
            secretProviderClass: "azure-kv-gcp-secrets"
      imagePullSecrets:
      - name: acr-secret
```

#### 6.4: Service (k8s-service.yaml)

```yaml
apiVersion: v1
kind: Service
metadata:
  name: rag-app-service
  namespace: rag-app-gcp
  labels:
    app: rag-app
spec:
  type: LoadBalancer
  sessionAffinity: ClientIP
  sessionAffinityConfig:
    clientIP:
      timeoutSeconds: 3600
  selector:
    app: rag-app
  ports:
  - port: 80
    targetPort: 3000
    protocol: TCP
    name: http
```

#### 6.5: HorizontalPodAutoscaler (k8s-hpa.yaml)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: rag-app-hpa
  namespace: rag-app-gcp
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: rag-app
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

---

### Step 7: Deploy to Kubernetes

```bash
# Apply manifests in order
kubectl apply -f k8s-configmap.yaml
kubectl apply -f k8s-secretproviderclass.yaml
kubectl apply -f k8s-deployment.yaml
kubectl apply -f k8s-service.yaml
kubectl apply -f k8s-hpa.yaml

# Verify deployment
kubectl get all -n $NAMESPACE
```

---

### Step 8: Verify Deployment

```bash
# Check pods are running
kubectl get pods -n $NAMESPACE

# Check secrets were synced from Key Vault
kubectl get secret rag-app-secrets-from-kv -n $NAMESPACE

# Get external IP
kubectl get service rag-app-service -n $NAMESPACE

# View logs
kubectl logs -f deployment/rag-app -n $NAMESPACE

# Check HPA
kubectl get hpa -n $NAMESPACE
```

Expected output:
```
 Cloud SQL (PostgreSQL) initialized
 Google Drive client initialized
 Found 32 files in folder
 Initial sync completed: 0 new, 32 skipped
```

---

##  Testing

```bash
# Get external IP
EXTERNAL_IP=$(kubectl get service rag-app-service -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

# Test health endpoint
curl http://$EXTERNAL_IP/health

# Test query endpoint
curl -X POST http://$EXTERNAL_IP/api/query \
  -H "Content-Type: application/json" \
  -d '{"question": "How do I reset the printer?"}'

# Test document list
curl http://$EXTERNAL_IP/api/documents
```

---

##  Maintenance Commands

### View Logs
```bash
# All pods
kubectl logs -f deployment/rag-app -n $NAMESPACE

# Specific pod
kubectl logs rag-app-xxxxx-yyyyy -n $NAMESPACE

# Previous pod (if crashed)
kubectl logs rag-app-xxxxx-yyyyy -n $NAMESPACE --previous
```

### Scale Manually
```bash
# Scale to 5 replicas
kubectl scale deployment rag-app --replicas=5 -n $NAMESPACE

# View current scale
kubectl get deployment rag-app -n $NAMESPACE
```

### Update Image
```bash
# Build new version
docker build -t $ACR_NAME.azurecr.io/rag-app-gcp:v1.1 .
docker push $ACR_NAME.azurecr.io/rag-app-gcp:v1.1

# Update deployment
kubectl set image deployment/rag-app \
  rag-app=$ACR_NAME.azurecr.io/rag-app-gcp:v1.1 \
  -n $NAMESPACE

# Watch rollout
kubectl rollout status deployment/rag-app -n $NAMESPACE
```

### Rollback
```bash
# Rollback to previous version
kubectl rollout undo deployment/rag-app -n $NAMESPACE

# View rollout history
kubectl rollout history deployment/rag-app -n $NAMESPACE
```

### Restart Pods
```bash
# Restart all pods
kubectl rollout restart deployment/rag-app -n $NAMESPACE

# Delete specific pod (auto-recreated)
kubectl delete pod rag-app-xxxxx-yyyyy -n $NAMESPACE
```

### Update Secrets
```bash
# Update secret in Key Vault
az keyvault secret set --vault-name $KEY_VAULT_NAME \
  --name "GCP-gemini-api-key" \
  --value "NEW_API_KEY"

# Force secret refresh (delete Kubernetes secret)
kubectl delete secret rag-app-secrets-from-kv -n $NAMESPACE

# Restart pods to pick up new secrets
kubectl rollout restart deployment/rag-app -n $NAMESPACE
```

---

##  Security Best Practices

### 1. Cloud SQL Firewall
```bash
# Add AKS outbound IP to Cloud SQL authorized networks
gcloud sql instances patch rag-postgres \
  --authorized-networks=EXTERNAL_IP/32 \
  --project=copper-depot-480116-h4
```

### 2. Network Policies
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: rag-app-netpol
  namespace: rag-app-gcp
spec:
  podSelector:
    matchLabels:
      app: rag-app
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 3000
  egress:
  - to:
    - namespaceSelector: {}
  - to:
    - podSelector: {}
```

### 3. Pod Security Standards
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: rag-app-gcp
  labels:
    pod-security.kubernetes.io/enforce: baseline
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

---

##  Additional Resources

- [AKS Documentation](https://docs.microsoft.com/en-us/azure/aks/)
- [Azure Key Vault CSI Driver](https://azure.github.io/secrets-store-csi-driver-provider-azure/)
- [Kubernetes Best Practices](https://kubernetes.io/docs/concepts/configuration/overview/)

---
