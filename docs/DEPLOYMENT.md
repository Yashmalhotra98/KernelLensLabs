# Deployment pipeline

KernelLens Labs uses two connected pipelines with different responsibilities:

```text
Git push or pull request
        |
        +--> GitHub Actions CI --> install --> test --> lint --> build
        |
        +--> Vercel Git integration --> Vite build --> preview or production URL
```

GitHub Actions proves that the source passes the project's automated checks. Vercel builds and hosts the static web application.

## Connect the repository to Vercel

1. Sign in to [Vercel](https://vercel.com/) with the GitHub account that can access `Yashmalhotra98/KernelLensLabs`.
2. Select **Add New → Project**.
3. Find `Yashmalhotra98/KernelLensLabs` and select **Import**. If it is not listed, configure the Vercel GitHub app and grant it access to this repository.
4. Keep the project root as `./`.
5. Confirm these build settings:
   - Framework preset: `Vite`
   - Install command: `npm ci`
   - Build command: `npm run build`
   - Output directory: `dist`
6. No environment variables are required for the current browser-only lesson.
7. Select **Deploy**.
8. In **Project Settings → Environments → Production → Branch Tracking**, confirm that the production branch is `main`.

After the connection is created:

- A push to a branch other than `main` creates a Vercel Preview deployment.
- A pull request receives a Preview deployment that can be tested before merging.
- A merge or push to `main` creates a Production deployment.

## Keep broken changes out of production

GitHub CI and Vercel builds start independently after a push. For a reliable gate, use pull requests instead of pushing directly to `main`:

1. Open the repository's **Settings → Branches** page on GitHub.
2. Add a branch protection rule for `main`.
3. Require a pull request before merging.
4. Require the `Test, lint, and build` status check to pass.
5. Optionally require the Vercel deployment check after the Vercel project is connected.

This makes the normal production path:

```text
feature branch --> preview --> CI passes --> review --> merge --> production
```

## Local equivalents

Run the same checks that GitHub executes:

```bash
npm ci
npm test
npm run lint
npm run build
```

The generated production files are written to `dist/`.

## Rollback

The simplest source-controlled rollback is to revert the bad Git commit and push the revert. Vercel also keeps immutable deployments that can be reassigned from the project's Deployments dashboard.

## Current deployment boundary

The application is entirely client-side. It does not need CUDA, a GPU, a database, secrets, or a long-running backend on Vercel. A future remote CUDA compilation service would be deployed separately and exposed through an API; untrusted source must never be compiled inside the static frontend deployment.
