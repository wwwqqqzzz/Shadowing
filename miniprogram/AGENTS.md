# Shadowing Mini-Program

Native WeChat mini-program (WXML+WXSS+JS), no cross-platform framework.

## STRUCTURE

```
miniprogram/
├── pages/          # 4 pages: home(stub), materials(list), practice(core), profile
├── components/     # 3 unused: player, recorder, subtitle
├── utils/          # 6 files: api, auth, format, mock-audio, request, util
├── mock/           # Phase 0 data.js + mock/audio/ directory
└── app.json        # pages[], tabBar, window config
```

## WHERE TO LOOK

| Need | File | Notes |
|------|------|-------|
| Core training loop | `pages/practice/practice.js` | 332 lines, monolithic: auto-pause, record, playback |
| Material list | `pages/materials/materials.js` | Browses materials, navigates to practice |
| Auth flow | `utils/auth.js` | wx.login → POST /auth/login, stores token+user |
| HTTP layer | `utils/request.js` | Hardcoded localhost:3000, 401 redirects to /pages/login/login |
| API wrappers | `utils/api.js` | getMaterial, getSentences, createPracticeRecord |
| Time formatting | `utils/format.js` + `utils/util.js` | Overlap: both do ms→mm:ss conversion |
| Mock data | `mock/data.js` | Fallback when API fails (Phase 0) |
| Fake audio engine | `utils/mock-audio.js` | 85 lines, never imported anywhere |

## CONVENTIONS

- **tabBar has 2 tabs** (materials, profile), not 3 as spec says
- **Components exist but no page uses `usingComponents`** to register them
- **`mock-audio.js` is dead code**, never required; practice.js uses `wx.createInnerAudioContext()` directly
- **`request.js` hardcodes** `http://localhost:3000/api` as BASE_URL
- **401 handler navigates** to `/pages/login/login` which does not exist
- **Auth flow**: materials → practice → (auto wx.login on API 401) → nonexistent login page

## PAGE FLOW

```
[materials] --tap material--> [practice]  (core loop)
[profile]  ------------------> [materials]
[any page] --401 response---> [login]      (page does not exist)
```

Home page is a stub (empty `data`, no-op `onLoad`), not reachable from tabBar.

## PECULIARITIES

- **home page is empty** (`data:{}`, `onLoad(){}`), registered in pages but not in tabBar
- **2-tab tabBar** vs spec's 3 tabs (missing home)
- **libVersion mismatch**: project.config.json says `3.6.1`, private override says `2.32.3`
- **No `usingComponents`** in any page JSON despite 3 components existing
- **`util.js` vs `format.js` overlap**: both convert ms to time strings; `format.js` has extra `formatRelativeTime`
- **`mock-audio.js` never imported**: practice.js uses real `InnerAudioContext`, making the 85-line mock dead code