# Backend `src/` — NestJS API

## OVERVIEW

NestJS REST API: auth via wx.login mock + JWT, CRUD for materials/sentences/practice-records/users, VTT import pipeline.

## STRUCTURE

| Module | Purpose |
|--------|---------|
| `auth/` | WeChat login (mock openid) → JWT issue; passport-jwt guard |
| `materials/` | Material CRUD + admin import (VTT parse → sentences); 2 controllers |
| `sentences/` | Sentence entity + service (exported provider, no controller) |
| `practice-records/` | User-scoped practice session logging + stats aggregation |
| `users/` | User profile read (me endpoint only) |
| `config/` | `registerAs('database', …)` with env fallbacks |

## WHERE TO LOOK

| Task | File |
|------|------|
| JWT validation & payload | `auth/jwt.strategy.ts` |
| Mock login logic | `auth/auth.service.ts:19-36` |
| VTT parsing (merge, absorb, drop) | `materials/vtt-parser.ts` |
| Material import + sentence creation | `materials/materials.service.ts` |
| Admin material endpoints | `materials/admin-materials.controller.ts` |
| Practice stats aggregation | `practice-records/practice-records.service.ts` |
| DB connection config | `config/database.config.ts` |
| App bootstrap & global prefix | `main.ts` (`/api` prefix, CORS, ValidationPipe) |

## CONVENTIONS

- **`noImplicitAny: false`** — implicit `any` allowed; ESLint `no-explicit-any` off
- **`synchronize: true`** always on in `app.module.ts:28` — no env guard; production must add conditional
- **JWT secret** read directly from `process.env.JWT_SECRET` in `jwt.strategy.ts:22` — inconsistent with DB config using ConfigService
- **Only one DTO** — `LoginDto`; all other controllers use raw `@Body()` with no validation DTO
- **Admin controller lives inside materials module** — `AdminMaterialsController` registered in `MaterialsModule`, not a separate admin module
- **SentencesModule** exports `SentencesService` but has no controller; consumed only by MaterialsModule
- **Global prefix** `/api` set in `main.ts:8`

## ROUTE MAP

All routes prefixed with `/api`.

| Method | Path | Handler | Auth |
|--------|------|---------|------|
| POST | `/auth/login` | `AuthService.login(code)` | No |
| GET | `/materials` | `MaterialsController.findAll` | No |
| GET | `/materials/:id` | `MaterialsController.findById` | No |
| GET | `/materials/:id/sentences` | `MaterialsController.findSentences` | No |
| POST | `/admin/materials/import` | `AdminMaterialsController.importMaterial` | No |
| PUT | `/admin/materials/:id/status` | `AdminMaterialsController.updateStatus` | No |
| DELETE | `/admin/materials/:id` | `AdminMaterialsController.deleteMaterial` | No |
| POST | `/practice-records` | `PracticeRecordsController.create` | JWT |
| GET | `/practice-records/my/stats` | `PracticeRecordsController.getMyStats` | JWT |
| GET | `/practice-records/my` | `PracticeRecordsController.getMyRecords` | JWT |
| GET | `/users/me` | `UsersController.getProfile` | JWT |

## ENTITIES

```
Material ──1:N──→ Sentence ──1:N──→ PracticeRecord
                                  ↑
User ──────────1:N─────────────────┘

Material: id(uuid), title, language, level, coverUrl?, audioUrl, durationMs, status(draft), source?, createdAt
Sentence: id(uuid), order, startTime, endTime, text, translation?, audioUrl?
PracticeRecord: id(uuid), audioUrl?, score?, errorWords?, durationMs, createdAt
User: id(uuid), openid(unique), nickname?, avatarUrl?, preferredLanguage, createdAt
```