# Backend deployment on Kubernetes

This guide walks through containerizing the API, pushing the image to a registry, and applying the manifests in `backend/k8s`.

## 1. Prerequisites

- A Kubernetes cluster (AKS, GKE, EKS, k3s, kind, etc.) and `kubectl` context pointing to it.
- An OCI-compatible registry (GHCR, Docker Hub, ACR, etc.).
- Docker/Podman for building images.
- Access to the production MySQL instance. The API expects `DATABASE_URL` in the Prisma format `mysql://USER:PASSWORD@HOST:PORT/DB`.

## 2. Build and push the container image

From the project root (or `backend/` directory) run:

```powershell
# Inside c:\Projects\Levelearn\backend
$registry = "ghcr.io/your-org"
$tag = "v$(Get-Date -Format yyyyMMddHHmmss)"
$fullImage = "$registry/levelearn-backend:$tag"

docker build -t $fullImage .
docker push $fullImage
```

Update `backend/k8s/deployment.yaml` and `backend/k8s/job-prisma-migrate.yaml` with the pushed image reference (or patch it via `kustomize edit set image`).

## 3. Provide environment variables

1. Copy your `.env` file (or the necessary keys) and create a Kubernetes secret:

   ```powershell
   kubectl create namespace levelearn --dry-run=client -o yaml | kubectl apply -f -
   kubectl create secret generic backend-secrets `
     --namespace levelearn `
     --from-env-file=.env
   ```

   Alternatively, edit `backend/k8s/secret-example.yaml`, replace the placeholder values, and apply it.

2. Adjust non-sensitive values (like `PORT`, `NODE_ENV`) in `backend/k8s/configmap.yaml` if needed.

## 4. Run Prisma migrations once per deploy

Apply (or re-run) the migration job every time a schema change ships:

```powershell
kubectl apply -f backend/k8s/job-prisma-migrate.yaml
kubectl wait --for=condition=complete job/prisma-migrate -n levelearn
kubectl delete job prisma-migrate -n levelearn
```

If you prefer schema migrations outside the cluster (CI/CD), skip the job and run `npx prisma migrate deploy` with direct DB access before rolling out pods.

## 5. Deploy the API

```powershell
kubectl apply -k backend/k8s
kubectl rollout status deployment/backend -n levelearn
```

The `Service` exposes the pods internally on port 80. Use the included `Ingress` manifest (requires an ingress controller) or change the service type to `LoadBalancer` for direct exposure.

## 6. Verify and update CORS

The server currently whitelists origins in `src/index.js`. Add your Kubernetes ingress/LoadBalancer host to the `allowedOrigins` array (or refactor the list to use an environment variable) before rolling out, otherwise browsers will hit CORS errors.

## 7. Operational tips

- Configure `imagePullSecrets` in `deployment.yaml` if your registry is private.
- Set up Horizontal Pod Autoscaler once you have baseline metrics, e.g. `kubectl autoscale deployment backend --cpu-percent=70 --min=2 --max=5 -n levelearn`.
- For file uploads handled by Multer, consider using object storage (S3, GCS, Azure Blob). Pods have ephemeral storage by default.
- Add monitoring/alerting (Prometheus, Grafana, Azure Monitor, etc.) and centralized logging (ELK, Loki) for production.
