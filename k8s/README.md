# Goalixa PWA - Kubernetes Manifests

This directory contains Kubernetes manifests for deploying the Goalixa Progressive Web App.

## Directory Structure

```
pwa/
├── namespace.yaml              # Namespace definition
├── configmap.yaml              # Application configuration
├── deployment.yaml             # Deployment manifest
├── service.yaml                # Service definition
├── ingress.yaml                # Ingress configuration
├── hpa.yaml                    # Horizontal Pod Autoscaler
├── poddisruptionbudget.yaml    # PodDisruptionBudget
├── kustomization.yaml          # Kustomize base configuration
└── overlays/
    ├── production/             # Production overlay
    └── staging/                # Staging overlay
```

## Prerequisites

1. Kubernetes cluster (v1.24+)
2. NGINX Ingress Controller
3. cert-manager for TLS certificates
4. Image pull secret for GitHub Container Registry

## Quick Start

### Create image pull secret:

```bash
kubectl create secret docker-registry ghcr-pull \
  --docker-server=ghcr.io \
  --docker-username=<github-username> \
  --docker-password=<github-token> \
  --namespace=goalixa-pwa
```

### Deploy to development:

```bash
kubectl apply -k .
```

### Deploy to production:

```bash
kubectl apply -k overlays/production
```

### Deploy to staging:

```bash
kubectl apply -k overlays/staging
```

## Configuration

The following environment variables can be configured via ConfigMap:

| Variable | Description | Default |
|----------|-------------|---------|
| `APP_ENV` | Environment name | `production` |
| `LANDING_API_URL` | Landing service URL | `http://goalixa-landing:80` |
| `AUTH_API_URL` | Auth service URL | `http://goalixa-auth:80` |
| `ENABLE_OFFLINE_SUPPORT` | Enable offline PWA support | `true` |
| `ENABLE_PUSH_NOTIFICATIONS` | Enable push notifications | `false` |

## Scaling

The PWA is configured with:

- **Min replicas**: 2
- **Max replicas**: 10
- **Target CPU utilization**: 70%
- **Target memory utilization**: 80%

## Access

- **Production**: https://pwa.goalixa.com
- **Staging**: https://staging-pwa.goalixa.com

## Health Check

The application exposes a `/health` endpoint for readiness and liveness probes.

## Troubleshooting

### Check pods:

```bash
kubectl get pods -n goalixa-pwa
```

### Check logs:

```bash
kubectl logs -f deployment/pwa -n goalixa-pwa
```

### Port forward for local testing:

```bash
kubectl port-forward -n goalixa-pwa svc/pwa 8080:80
```

Then visit http://localhost:8080
