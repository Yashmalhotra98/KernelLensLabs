# GPU Algorithm Visualizer

[![CI](https://github.com/Yashmalhotra98/KernelLensLabs/actions/workflows/ci.yml/badge.svg)](https://github.com/Yashmalhotra98/KernelLensLabs/actions/workflows/ci.yml)

An interactive React application for learning how a CUDA matrix-multiplication kernel maps work onto thread blocks, warps, threads, registers, and global memory.

## Current learning slice

The browser currently supports one deterministic lesson: a naïve 8 × 8 matrix multiplication split into four 4 × 4 thread blocks. A virtual scheduler maps those blocks onto three teaching SMs in two waves. Learners can edit the CUDA source, run educational static analysis, and replay the trace with Run, Pause, Step, and Reset controls.

The visualization uses five semantic-zoom levels—Algorithm, GPU, Block, Warp, and Thread—so beginners reveal architectural detail gradually instead of seeing every subsystem simultaneously.

The current analyzer is intentionally not presented as NVCC. It catches structural mistakes and common beginner errors inside the supported lesson subset. See [`docs/DECISIONS.md`](docs/DECISIONS.md) for the architecture and limitations.

## Local development

```bash
npm ci
npm run dev
```

Open `http://localhost:5173`.

## Production build

```bash
npm run lint
npm test
npm run build
npm run preview
```

## Docker

Build and run the production Nginx image:

```bash
docker compose up --build
```

Open `http://localhost:8080`. Stop it with `docker compose down`.

The Docker image is suitable for container hosts such as Render. Vercel uses the Vite build directly (`npm run build`) and serves the generated `dist` directory.

## Continuous integration and deployment

GitHub Actions runs the test, lint, and production-build checks for pushes and pull requests targeting `main`. Vercel can then deploy every branch as a Preview and `main` as Production through its Git integration.

Follow the one-time setup and branch-protection instructions in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Current learning flow

```text
Algorithm: A × B → four output tiles
    ↓
GPU: four blocks → three virtual SMs → two scheduling waves
    ↓
Block: 4 × 4 threads own one output tile
    ↓
Warp: 16 allocated lanes inside a 32-lane warp
    ↓
Thread: index arithmetic, registers, operands, and addresses
```

The trace is a deterministic educational model, not a cycle-accurate hardware measurement. Source is held only in React memory and is neither uploaded nor saved.
