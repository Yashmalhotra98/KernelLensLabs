# KernelLens

[![CI](https://github.com/Yashmalhotra98/KernelLensLabs/actions/workflows/ci.yml/badge.svg)](https://github.com/Yashmalhotra98/KernelLensLabs/actions/workflows/ci.yml)

An interactive React application for learning how CUDA algorithms map work onto thread blocks, warps, threads, and the GPU memory hierarchy.

## Current curriculum

The browser provides 14 deterministic lessons:

- Foundations: Vector Addition and Unified Memory Vector Addition
- Memory: Coalesced versus strided access
- Matrix operations: Naïve and Blocked Matrix Multiplication
- CUDA libraries: cuBLAS AXPY and GEMM semantics
- Collective algorithms: Shared-memory Sum Reduction
- Parallel sorting: Bitonic Sort with six compare–exchange stages
- Convolution: Naïve, Constant-Memory, Tiled, and Cache-Simplified 1-D Convolution plus Naïve 2-D Convolution

Learners can edit each sample, run lesson-aware analysis, and replay its trace with Run, Pause, Step, and Reset. Every plugin lesson computes a trusted CPU reference. Compatible vector lessons can additionally validate their output through WebGPU when the browser supports it.

The visualization uses five semantic-zoom levels—Algorithm, GPU, Block, Warp, and Thread—so beginners reveal architectural detail gradually instead of seeing every subsystem simultaneously.

The analyzer is intentionally not presented as NVCC. It checks required structures inside each supported lesson. Unified Memory migration, cache transactions, and cuBLAS internals are explicitly labelled educational models rather than hardware measurements. See [`docs/DECISIONS.md`](docs/DECISIONS.md) for the architecture and limitations.

## Local development

```bash
make install
make dev
```

Open `http://localhost:5173`.

The Makefile is a command wrapper. If `make` is unavailable, run the npm commands shown by `make help` directly.

## Production build

```bash
make verify
make preview
```

## Docker

Build and run the production Nginx image in the foreground:

```bash
make docker-up
```

Open `http://localhost:8080`. Press `Ctrl+C`, then stop and remove the Compose container with `make docker-down`.

For a background container:

```bash
make docker-up-detached
make docker-status
make docker-logs
make docker-down
```

The equivalent raw Docker commands are `docker compose up --build`, `docker compose up --build --detach`, and `docker compose down`.

The Docker image is suitable for container hosts such as Render. Vercel uses the Vite build directly (`npm run build`) and serves the generated `dist` directory.

## Continuous integration and deployment

GitHub Actions runs the test, lint, and production-build checks for pushes and pull requests targeting `main`. Vercel can then deploy every branch as a Preview and `main` as Production through its Git integration.

Follow the one-time setup and branch-protection instructions in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Runtime learning flow

```text
Editable lesson source
    ↓
Lesson-specific analyzer
    ↓
CPU reference computation
    ↓
Deterministic teaching frames
    ↓
Shared React trace player
    ├── logical lanes
    ├── global/shared/constant/managed memory
    └── computed-output validation
```

The specialized naïve-matmul lesson retains its Algorithm → GPU → Block → Warp → Thread semantic zoom and three-SM scheduling model. Every trace is educational rather than cycle-accurate. Source is held only in React memory and is neither uploaded nor saved.
