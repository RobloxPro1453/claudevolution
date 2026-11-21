# Architecture

How the system works: no longer than a page. The detail is in the code; here only "which part does what, who talks to whom".

## Parts

| Part | Where | Its job in one sentence |
|---|---|---|
| <e.g. Interface> | `src/ui/` | <what it does> |
| <e.g. Core> | `src/core/` | <what it does> |

## Flow

<The path of one user action from start to end, 3-6 steps. E.g. "Save → validation → write to file → add to history".>

## Boundaries and rules

- <The allowed way parts talk; e.g. "The interface reaches data only through `api`.">
- <Outside dependencies and why.>

## Folders

```
src/        <what>
tests/      <what>
docs/       project memory (AGENTS.md > Where to look)
.evrim/     claudevolution settings and unattended memory
```
