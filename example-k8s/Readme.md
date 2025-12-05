# Kubernetes Deployment Templates

This directory contains template Kubernetes manifests for deploying the RAG application to Azure Kubernetes Service (AKS).

## Before Deploying

**IMPORTANT**: These are template files with placeholder values. You MUST update the following values before deploying:

### In `secret-provider-class.yaml`:
- `userAssignedIdentityID` - Your AKS kubelet identity client ID
- `keyvaultName` - Your Azure Key Vault name
- `tenantId` - Your Azure tenant ID

### In `deployment.yaml`:
- `image` - Your Azure Container Registry (ACR) image name

### How to Get These Values:

```bash
# Get kubelet identity client ID
az aks show --resource-group YOUR-RG --name YOUR-AKS-CLUSTER \
  --query "identityProfile.kubeletidentity.clientId" -o tsv

# Get tenant ID
az account show --query tenantId -o tsv
```

## Files Overview

| File | Description | Needs Update |
|------|-------------|--------------|
| `namespace.yaml` | Creates the rag-app namespace | ❌ No |
| `pvc.yaml` | Creates persistent storage (10Gi) | ❌ No |
| `secret-provider-class.yaml` | Mounts secrets from Azure Key Vault | ✅ Yes |
| `deployment.yaml` | Deploys the application (2 replicas) | ✅ Yes |
| `service.yaml` | Exposes the app via LoadBalancer | ❌ No |
| `ingress.yaml` | (Optional) Ingress for domain access | ⚠️ Optional |

## Deployment Order

Follow this order to deploy:

```bash
# 1. Create namespace
kubectl apply -f namespace.yaml

# 2. Create persistent volume claim
kubectl apply -f pvc.yaml -n rag-app

# 3. Create secret provider class (AFTER updating values)
kubectl apply -f secret-provider-class.yaml -n rag-app

# 4. Deploy application (AFTER updating image name)
kubectl apply -f deployment.yaml -n rag-app

# 5. Create service
kubectl apply -f service.yaml -n rag-app

# 6. (Optional) Create ingress
kubectl apply -f ingress.yaml -n rag-app
```

## Verification

```bash
# Check all resources
kubectl get all -n rag-app

# Check pods
kubectl get pods -n rag-app

# Check logs
kubectl logs -n rag-app <POD_NAME>

# Check service (get external IP)
kubectl get svc -n rag-app
```

## Complete Setup Guide

For complete step-by-step instructions including:
- Azure resource creation
- Secrets configuration
- Docker build and push
- Troubleshooting

See: [SETUP_GUIDE.md](../SETUP_GUIDE.md)

## Resource Requirements

### Per Pod:
- **Requests**: 512Mi memory, 250m CPU
- **Limits**: 2Gi memory, 1000m CPU

### Storage:
- **PVC**: 10Gi (ReadWriteOnce)

### Recommended AKS Node Size:
- `Standard_D4s_v3` (4 vCPU, 16GB RAM) or larger
- Minimum 2 nodes for high availability

## Health Checks

The deployment includes:
- **Liveness Probe**: Checks `/health` endpoint every 30s
- **Readiness Probe**: Checks `/health` endpoint every 10s  
- **Startup Probe**: Initial health check on pod start

## Scaling

```bash
# Manual scaling
kubectl scale deployment rag-app --replicas=3 -n rag-app

# Auto-scaling
kubectl autoscale deployment rag-app \
  --cpu-percent=70 \
  --min=2 \
  --max=5 \
  -n rag-app
```

## Updates

To update the application:

```bash
# Update image version in deployment.yaml, then:
kubectl apply -f deployment.yaml -n rag-app

# Or use kubectl set image:
kubectl set image deployment/rag-app \
  rag-app=YOUR-ACR.azurecr.io/rag-app:v2.0 \
  -n rag-app
```

## Troubleshooting

### Pods Not Starting

```bash
# Check events
kubectl describe pod -n rag-app <POD_NAME>

# Check logs
kubectl logs -n rag-app <POD_NAME>

# Common issues:
# 1. Image pull errors - verify ACR is attached to AKS
# 2. Secret mounting errors - verify Key Vault permissions
# 3. Missing environment variables - check secret-provider-class.yaml
```

### Secrets Not Loading

```bash
# Verify secret provider class
kubectl get secretproviderclass -n rag-app

# Check created secrets
kubectl get secrets -n rag-app

# Force refresh (delete and recreate)
kubectl delete secret rag-app-secrets -n rag-app
kubectl delete pods --all -n rag-app
```

## Security Notes

- All secrets are stored in Azure Key Vault
- Secrets are mounted via CSI driver (not hardcoded)
- Managed identity is used for Key Vault access (no passwords)
- Service uses non-root container user
- Secrets are mounted as read-only volumes

## Support

For issues or questions, refer to:
1. [SETUP_GUIDE.md](../SETUP_GUIDE.md) - Complete deployment guide
2. Application logs: `kubectl logs -n rag-app <POD_NAME>`
3. Kubernetes events: `kubectl get events -n rag-app --sort-by='.lastTimestamp'`