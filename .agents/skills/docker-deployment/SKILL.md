---
name: docker-deployment
description: Guidelines for containerizing and deploying the OpenWA NestJS backend and React frontend.
---

# Docker & Deployment Best Practices

Follow these guidelines when generating `Dockerfile`s, `docker-compose.yml`, or CI/CD pipelines.

## 1. Multi-Stage Builds

- Always use multi-stage Docker builds to keep the final image size small and secure.
- **Builder Stage:** Install all `devDependencies`, build the application (e.g., `npm run build`), and prune development dependencies if necessary.
- **Runner Stage:** Use a minimal base image (e.g., `node:20-alpine`), copy only the built artifacts and production `node_modules` from the builder stage.

## 2. Security Defaults

- **Non-Root User:** Never run the application as the `root` user inside the container. Always switch to the `node` user (e.g., `USER node`).
- **No Secrets in Image:** Never hardcode secrets in the Dockerfile. Always pass them at runtime via environment variables or a `.env` file injected by the orchestrator.

## 3. Performance & Caching

- **Dependency Caching:** Copy `package.json` and `package-lock.json` and run `npm ci` _before_ copying the rest of the source code. This leverages Docker layer caching to speed up builds when code changes but dependencies do not.

## 4. Health Checks

- Ensure a `/health` or `/ping` endpoint exists in the NestJS application and is configured as a `HEALTHCHECK` instruction in the Dockerfile to allow orchestrators (Docker Swarm, Kubernetes) to monitor availability.
