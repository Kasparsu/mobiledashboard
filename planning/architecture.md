# Mobile Dashboard — Architecture

Personal dashboard combining:
1. **Tahvel schedule** — Kaspar Martin Suursalu's lessons (teacher view)
2. **Transit commute intelligence** — when to leave home for next lesson, fastest way home from work
3. **Contextual display** — only show what's relevant right now, based on current location + time

## Data sources

| Source | Access | Purpose |
|---|---|---|
| `tahvel-tunniplaan-proxy.azurewebsites.net/api/proxy?url=...` | CORS proxy (community-run) | Tahvel timetable + entity search |
| `api.peatus.ee/reitti/api/journey` | Direct, `CORS: *` | Trip planning (from, to, time) |
| `transport.tallinn.ee/siri-stop-departures.php?stopid=X` | Direct, `CORS: *` | Live departures (optional polish) |
| `transport.tallinn.ee/data/gtfs.zip` | Build-time | Stops + routes static (if we want offline stop lookup) |

Known risks:
- The Azure Tahvel proxy is community-run; could disappear. Swap to our own Cloudflare Worker if it does.

## State model (Pinia + localStorage)

```ts
// stores/locations.ts
type Location = {
  id: string         // uuid
  name: string       // "Home", "Work", "TTK Mustamäe"
  lat: number        // decimal degrees
  lng: number
  icon?: string      // emoji or iconify name
}

type LocationsState = {
  locations: Location[]
  currentId: string | null   // which location the user is at right now
}

// stores/schedule.ts
type ScheduleTarget = {
  type: 'teacher' | 'group'
  uuid: string
  name: string
}

type ScheduleState = {
  target: ScheduleTarget | null   // defaults to Kaspar Martin Suursalu
  events: Lesson[]                // parsed & normalized
  fetchedAt: number               // timestamp
  weekStart: Date
}

// stores/commute.ts — derived, not persisted
type CommuteState = {
  leaveBy: Date | null            // next "you should leave" moment
  toLocationId: string | null     // destination location ID
  journey: JourneyPlan | null     // from peatus.ee
  reason: 'next-lesson' | 'go-home' | null
}
```

All three stores persist to localStorage except `commute` (recomputed on demand).

## UI structure

Two tabs, bottom-nav style for mobile:

### 1. Now (default)
Single-focus card with the **one piece of information you need right now**:
- **At home + lessons today** → "Leave at HH:MM — next: [lesson] at [building]"
- **At school + lesson active** → "Now: [subject] · Room X · ends HH:MM"
- **At school + lesson upcoming today** → "Next: [subject] in X min · Room Y"
- **At work, past work hours or no more lessons** → "Leave at HH:MM for home — [line X] at HH:MM"
- **No current location set** → list today's lessons + "Set current location" prompt

Below the focused card: compact "later today" list.

### 2. Config
- **Locations** list
  - Each row: name + coords (click to edit), icon, "Set as current" button, delete
  - "Add location" button — opens modal with name field + "Capture GPS" button (uses `navigator.geolocation.getCurrentPosition`) + manual lat/lng fallback
  - "Currently at" indicator — which location is active
- **Schedule target** — search Tahvel, pick teacher/group. Defaults pre-seeded with Kaspar Martin Suursalu.
- **Preferences**
  - Buffer minutes before "leave by" (default 10)
  - Work hours / "when am I at work" (optional; informs contextual widget)

## Commute prediction algorithm

### "When to leave home"
```
trigger: currentLocation === home && nextLesson exists today
inputs: currentLocation (lat/lng), lessonLocation (lat/lng), lesson.start, bufferMin
steps:
  1. journey = peatus.planJourney({from, to, arriveBy: lesson.start})
  2. leaveBy = journey.startTime - bufferMin
output: { leaveBy, journey, nextLesson }
```

### "Fastest way home"
```
trigger: currentLocation !== home && shouldGoHome (configurable; e.g. workHoursEnded || lessonsDone)
steps:
  1. journey = peatus.planJourney({from: currentLocation, to: home, departAfter: now})
output: { arriveBy, journey }
```

### Lesson location mapping
- v1: all lessons assumed at single "School" location set in Config (TTK Mustamäe by default).
- v2 (optional): map Tahvel `rooms[].roomCode` prefixes to building-specific locations (if TTK has multiple campuses relevant).

## peatus.ee journey API — to be discovered

Next step is to figure out the exact request shape. Likely POST to `/reitti/api/journey` with JSON `{from: {lat, lng}, to: {lat, lng}, time, timeIs: 'arrival'|'departure'}`. Will confirm empirically before building the client.

## Build order

1. **Locations store + Config tab** — foundation; all downstream features read from it
2. **Schedule store + today fetch** — port the prototype's Tahvel API + normalization into a store; no UI yet
3. **peatus.ee API client** — figure out request shape, build typed wrapper, unit test with a known pair of coords
4. **Commute store + prediction logic** — combines locations, schedule, peatus
5. **"Now" screen** — the contextual single-card view
6. **Polish** — schedule list below the focused card, nice transitions, empty states

Estimated work: 3–5 focused sessions.

## Open decisions

- **Bottom nav or top tabs** — bottom for mobile-first. Decision: bottom.
- **Manual current-location vs GPS auto-detect** — manual only at v1 (simpler, user said "ability to mark current location"). v2 could add "auto-detect on load" with permission prompt.
- **Icon library** — daisyUI ships with none; we'll need iconify via `@iconify/vue` or similar. Decision: use Phosphor icons (matches their nerd-font aesthetic, good mobile coverage).
- **Map view** — skip for v1. Maybe add later if we want to *see* the vehicle positions.
