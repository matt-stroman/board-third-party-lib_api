# board-third-party-lib_api

Design and tests for the API for the Board third party library.

## Table of Contents

- [Postman Workflow](#postman-workflow)
- [GitHub Actions Mock Contract Tests (CI)](#github-actions-mock-contract-tests-ci)
- [Mock-First Flow](#mock-first-flow)
- [Repository Files](#repository-files)
- [Planning Files](#planning-files)
- [Working Rules](#working-rules)

## Postman Workflow

This repository is connected to a Postman project workspace using Postman Native Git.

Local development updates the files in this repo (`postman/`, `.postman/`), and Postman Cloud provides the workspace, mock servers, and synced Native Git artifacts.

This project uses a CLI-first workflow:

- use the Git-tracked OpenAPI spec and Git-tracked contract/admin collections as the source of truth
- use Redocly CLI for OpenAPI linting and Postman CLI for contract execution/workspace sync
- use `postman workspace push --yes` to sync the connected Postman workspace after `main` changes
- treat any API Builder generated collection as optional disposable UI output only, not as a required test or sync artifact

### Supported Model

- Keep exactly one **Git-tracked test collection** in this repo:
  - `postman/collections/board-third-party-library-api.contract-tests.postman_collection.json`
- Keep one separate **Git-tracked Postman admin collection** for Postman Cloud provisioning tasks (mock server setup, inspection):
  - `postman/collections/postman-admin.board-third-party-library-mock-provisioning.postman_collection.json`
- Keep the OpenAPI spec as the contract source of truth:
  - `postman/specs/board-third-party-library-api.v1.openapi.yaml`
- Do not make contract validation, mock provisioning, or workspace sync depend on a generated collection.

### GitHub Automation

The maintained GitHub Actions workflow automates the important Postman checks and sync points:

- `postman-mock-contract-tests.yml`
  - lints the local OpenAPI spec with Redocly CLI
  - provisions a fresh Postman mock from the Git-tracked contract test collection snapshot
  - runs the Git-tracked contract test collection with Postman CLI
  - deletes the CI-created mock after the run
- `postman-workspace-sync.yml`
  - runs on `main`
  - pushes Native Git artifacts from this repo to the connected Postman workspace with `postman workspace push --yes`
  - reprovisions the shared mock and syncs the `Board Third Party Library - Mock` environment `baseUrl`
  - validates the synced workspace assets against that shared mock with Postman CLI

This means normal team workflow does not require:

- manually regenerating a linked generated collection
- manually running the admin provisioning collection after every merge
- manually running contract checks in Postman UI just to validate repo changes

### Local Development

Recommended local setup:

1. Install Node.js and Postman CLI.
2. From the solution root, authenticate once with an API key if you need workspace sync or mock provisioning operations:

```bash
python ./scripts/dev.py api-login --postman-api-key <your-postman-api-key>
```

If you prefer one-off authenticated commands, the root CLI also accepts `--postman-api-key` directly on `api-mock` and `api-sync`.

3. Run local contract tests against the backend from the solution root:

```bash
python ./scripts/dev.py api-test
```

That root command runs:

- the Git-tracked contract test collection
- against the Git-tracked local environment template
- with `baseUrl=http://localhost:5085`
- with `contractExecutionMode=live`

If the backend is not already running in another terminal, the root CLI can start it for the run:

```bash
python ./scripts/dev.py api-test --start-backend --skip-lint
```

Important for live local runs:

- the committed local environment file includes placeholders for `accessToken`, `organizationId`, `organizationSlug`, `titleId`, and `titleSlug`
- authenticated success-path requests for organization and Wave 3 title workflows are skipped until you replace those placeholders with real local values
- this is expected; public routes and unauthenticated/error-path coverage still run with the committed template

If you want to run spec lint locally through the root CLI, run:

```bash
python ./scripts/dev.py api-lint
```

If you need an immediate manual workspace sync before `main` automation runs:

```bash
python ./scripts/dev.py api-sync --postman-api-key <your-postman-api-key>
```

That root command runs:

- `postman workspace prepare`
- `postman workspace push --yes`
- shared mock reprovisioning unless `--skip-mock` is supplied

Normal feature work does not require Postman UI pull/push or generated collection regeneration.
The supported developer entry point for this project is the root `python ./scripts/dev.py ...` CLI. Scripts under `api/scripts/` remain as implementation details for CI and the root automation layer.

## GitHub Actions Mock Contract Tests (CI)

The `api` repository includes a GitHub Actions workflow that runs the Git-tracked Postman contract tests with Postman CLI on `push`, `pull_request`, and manual dispatch:

- Workflow file: `.github/workflows/postman-mock-contract-tests.yml`
- Workspace sync workflow: `.github/workflows/postman-workspace-sync.yml`

### Required GitHub secret

- `POSTMAN_API_KEY`

Use a Postman API key for an account (or service account) that has access to the workspace referenced by the Mock Admin environment (`workspaceId` in `postman/environments/board-third-party-library_mock-admin.postman_environment.json`).

No static mock URL secret is required.

### CI mock lifecycle (per run)

To avoid stale mock URLs and stale Postman collection snapshots, the workflow performs these steps during each run:

1. Resolve the contract test collection in Postman using the Mock Admin environment metadata (name/ID).
2. Update that Postman collection from the current repo file (`postman/collections/board-third-party-library-api.contract-tests.postman_collection.json`).
3. Create a fresh Postman mock server for the run and capture its `mockUrl`.
4. Run Postman CLI against the repo-tracked collection using the generated `mockUrl` as `baseUrl`.
5. Delete the CI-created mock server during cleanup (even if the contract run fails).

### Fork pull requests

GitHub does not expose repository secrets to forked pull requests. The workflow detects this and skips the mock-based contract run for fork PRs rather than failing on missing credentials.

## Mock-First Flow

The contract test collection includes:

- saved examples for the health endpoints (including `/health/ready` `200` and `503`)
- a `Mock Validation` folder with a mock-only request that forces the saved `503` readiness example using Postman mock headers

### Files used for mock-first work

- `postman/environments/board-third-party-library_mock.postman_environment.json`
- `postman/environments/board-third-party-library_mock-admin.postman_environment.json`
- `postman/collections/postman-admin.board-third-party-library-mock-provisioning.postman_collection.json`
- `postman/collections/board-third-party-library-api.contract-tests.postman_collection.json`

### Auth note for authenticated identity contract tests

The Git-tracked contract test collection sends `Authorization: Bearer {{accessToken}}` for authenticated identity requests such as `GET /identity/me`.

The collection supports two execution modes:

- `mock`: assert saved example responses and run the `Mock Validation` folder
- `live`: run portable smoke assertions by default, and only run auth-success assertions when you provide real auth artifacts in the environment

Environment variables:

- `Board Third Party Library - Mock` includes a non-secret placeholder `accessToken` (mock runs only need a non-empty value when forcing saved examples).
- `Board Third Party Library - Mock` also includes `authCallbackCode` / `authCallbackState` values used by the saved callback example.
- `Board Third Party Library - Local` includes `accessToken`, `authCallbackCode`, and `authCallbackState` placeholders that should be replaced with real values if you want to exercise the authenticated success-path requests against a live backend.

Security mock validation coverage is included for the current authenticated identity endpoints and exercises saved examples for:

- `401 Unauthorized`

Important:

- The same collection can be run against mock, local, or remote environments, but not every request can assert the same thing in every environment.
- Mock-only example-selection requests are skipped automatically outside `mock` mode.
- Live auth-success requests are skipped automatically unless you provide a real bearer token and, for callback-success verification, a real authorization `code` and `state`.
- If a live environment still fails after those prerequisites are provided, that is a real backend contract gap rather than a Postman-environment issue.

### Current auth semantics (contract guidance)

The current implemented authentication surface is modeled as a Keycloak-hosted browser flow. The contract documents these expectations so backend implementation and client behavior stay aligned:

- **Hosted registration/login**: `GET /identity/auth/login` redirects callers to Keycloak using authorization code + PKCE. When self-registration is enabled in the realm, users can register from the hosted Keycloak page.
- **Callback exchange**: `GET /identity/auth/callback` completes the code exchange and returns tokens plus the resolved current-user summary.
- **Provider brokering**: optional `provider` query input on `GET /identity/auth/login` maps to Keycloak identity-provider hints for future social-login scenarios.
- **Account lifecycle ownership**: password reset, email verification, and external identity linking are Keycloak concerns and are not modeled as first-party API endpoints in this contract.
- **Wave 1 persistence**: `GET|PUT|DELETE /identity/me/board-profile` is part of the maintained contract and maps to the application-owned Board profile linkage/cache persisted in PostgreSQL.

### Current Wave 3 catalog semantics (contract guidance)

- **Storefront routing**: public title detail uses `/catalog/{organizationSlug}/{titleSlug}` rather than a bare title ID.
- **Lifecycle vs visibility**: `lifecycleStatus` and `visibility` are intentionally separate so testing titles can be public or hidden without changing their lifecycle phase.
- **Visibility behavior**: `listed` titles appear in public catalog browse results, `unlisted` titles are reachable by direct route key only, and `private` titles are not publicly reachable.
- **Metadata history**: title metadata remains mutable while a title is `draft`; once it leaves draft, metadata revisions are preserved as history and later edits create new revisions.

### Provision the mock server (code-driven in Postman)

The mock server is provisioned from a Postman **workspace collection object** selected by the Mock Admin environment.

Default:
- `Board Third Party Library API (Contract Tests)`

Why:
- this is the Git-tracked contract source used by CI and local CLI runs
- it avoids any dependency on API Builder generated collection state

The Mock Admin environment controls which workspace collection is used as the mock source:

- `mockSourceCollectionName` (default: `Board Third Party Library API (Contract Tests)`)
- `mockSourceCollectionPostmanId` (optional exact Postman collection ID override if duplicate collections exist)

Leave the collection ID overrides blank by default. Postman collection IDs can change when workspace artifacts are regenerated or recreated, while name-based resolution remains stable for normal day-to-day mock provisioning.

The supported stable setting is `Board Third Party Library API (Contract Tests)`.

1. In Postman, import/sync both environments:
   - `Board Third Party Library - Mock` (day-to-day contract test runs)
   - `Board Third Party Library - Mock Admin` (mock provisioning/maintenance)
2. Select `Board Third Party Library - Mock Admin`.
3. Add your Postman API key to **Postman Vault** as `postman-api-key` (local secret), so the admin collection can use `{{vault:postman-api-key}}`.
4. Enable Vault access for scripts (one-time Postman setup) and grant this collection/workspace access when prompted.
6. Run `Postman Admin - Board Third Party Library Mock Provisioning`:
   - `Collections / Provision/refresh mock server (one-step)`
7. The collection test scripts will populate in the **Mock Admin** environment:
   - `mockSourceCollectionUid`
   - `mockId`
   - `mockUrl`
   - `baseUrl` (set to the created mock URL)
8. The one-step admin request will also attempt to automatically sync `Board Third Party Library - Mock` `baseUrl` via the Postman API by resolving the runtime environment from `mockRuntimeEnvironmentName` on each run and then caching the current `mockRuntimeEnvironmentId`.
9. Run `Board Third Party Library API (Contract Tests)` against `Board Third Party Library - Mock`.

The one-step provisioning request performs a preflight validation of the resolved mock source collection snapshot (route presence + saved examples for currently required endpoints). If it fails, fix the mock source collection/workspace object first instead of trusting mock-based contract test failures.

If the contract test run fails immediately with a `400` response whose body contains `inactiveMockError`, the environment is pointing at a deleted or replaced Postman mock. Refresh/pull the connected repository if needed, rerun `Provision/refresh mock server (one-step)`, and then rerun the contract tests.

Important for local/manual runs: Postman uses your local environment variable value when you send requests in your own instance. The provisioning collection updates the Mock environment through the Postman API, which updates the shared environment value in the workspace. If you manually cleared `Board Third Party Library - Mock.baseUrl` locally, that blank local override will continue to win until you reset it back to the shared value. In that case, use `Reset value` on `baseUrl` (or `Reset all`) in the `Board Third Party Library - Mock` environment after provisioning.

### If runtime Mock environment auto-sync fails

Use the `Environments` folder in the Postman admin collection:

1. `Environments / List environments and resolve Mock runtime environment ID`
2. `Collections / Provision/refresh mock server (one-step)` (retry; it will resolve the runtime environment by name and auto-sync `baseUrl`)

Optional manual fallback:

- `Environments / Sync Mock runtime environment baseUrl from mockUrl`

### Why some mock-admin environment variables start blank

These values are intentionally blank in the versioned **Mock Admin** environment template and are populated by the Postman admin provisioning collection after you run it:

- `mockSourceCollectionUid`
- `mockId`
- `mockUrl`
- `mockRuntimeEnvironmentId`

`baseUrl` in **Mock Admin** starts as a placeholder and is overwritten with `mockUrl` by the provisioning collection once the mock is created.

### Making the Mock environment "ready to go"

The admin collection attempts to keep `Board Third Party Library - Mock` `baseUrl` in sync automatically whenever a new mock server is created.

If your team decides to keep a stable mock URL for a while, you can also update the versioned runtime mock environment file:

- `postman/environments/board-third-party-library_mock.postman_environment.json`

Then most day-to-day work only needs the `Board Third Party Library - Mock` environment, and the `Mock Admin` environment/collection are only used when the mock server must be created or repaired.

### Mock response selection notes

- `Health / Readiness health check` validates the default saved example (expected healthy path).
- `Mock Validation / Readiness health check (Mock 503 example)` forces the unhealthy saved example using:
  - `x-mock-response-code: 503`
  - `x-mock-response-name: API is running but not ready due to dependency failure.`

## Repository Files

- `postman/specs/`: OpenAPI definitions (contract source of truth)
- `postman/collections/`: Git-tracked executable contract/smoke test collections and Postman admin/provisioning collections
- `postman/environments/`: Non-secret environment templates
- `postman/globals/`: Workspace globals when needed
- `.postman/config.json`: Postman Native Git workspace metadata and tracked artifact paths

## Planning Files

- `planning/`: historical planning/context artifacts that are not the maintained API contract

## Working Rules

- Generated collections are optional UI artifacts only and are not part of the required automation path.
- Git-tracked collections are for executable tests and workflow assertions.
- Keep Postman Cloud admin/provisioning requests in a separate collection from API contract tests.
- Keep filenames stable once Postman Native Git is tracking them to avoid duplicate workspace artifacts.
