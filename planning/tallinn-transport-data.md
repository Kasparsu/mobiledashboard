# Tallinn Transport Data — Endpoint Analysis

Investigated at transport.tallinn.ee. Five endpoints cover static + real-time needs.

## Static data

### `/data/gtfs.zip` — best static source
Standard GTFS feed. 2.6 MB compressed, 21 MB uncompressed.

| File | Size | Purpose |
|---|---|---|
| `agency.txt` | 151 B | Operator identity |
| `routes.txt` | 5.5 KB | Route metadata |
| `stops.txt` | 58 KB | Stops with coords |
| `trips.txt` | 2.3 MB | Every trip instance |
| `stop_times.txt` | 17 MB | Arrival/departure per stop per trip |
| `shapes.txt` | 1.6 MB | Polyline geometry per route |
| `calendar.txt` / `calendar_dates.txt` | 8 + 33 KB | Service days and exceptions |

Standard format → any GTFS parser works (e.g. `gtfs-parser-js`, parse manually with Papa-style CSV).

### `/data/routes.txt` — Pikas proprietary
Same info as GTFS `routes.txt` but in Tallinn's own "Pikas" format. Skip in favor of the GTFS version.

Columns: `RouteNum;Authority;City;Transport;Operator;ValidityPeriods;SpecialDates;RouteTag;RouteType;Commercial;RouteName;Weekdays;Streets;RouteStops;RouteStopsPlatforms`

Notes if we do need it:
- `;` separator, UTF-8 with BOM
- One route → multiple lines (one per direction `a-b`/`b-a` and per variant)
- `RouteStopsPlatforms` is comma-separated `stopID-platform` (e.g. `21215-1`)
- Blank first columns mean "inherit from previous filled row"

### `/data/stops.txt` — Pikas stops
Columns: `ID;SiriID;Lat;Lng;Stops;Name;Info;Street;Area;City`

Coords are integers — divide by 100000:
`5957134 → 59.57134° N`, `2475791 → 24.75791° E`

3729 lines. IDs like `aid123360`, `a21302-1`. Again, redundant with GTFS stops.txt.

## Real-time data

### `/gps.txt` — live vehicle positions
~19 KB, refreshes on demand. Plain CSV (no header).

Columns (inferred from data — needs confirmation):
```
transport_type, direction, lng*100000, lat*100000, _, bearing, speed?, live_flag, route_num, heading_to_stop
```

Example row: `3,2,24676500,59457500,,135,99,Z,27,Suur-Paala`
→ tram, direction 2, lng 24.67650 lat 59.45750, bearing 135, speed 99 (?), flag `Z`, route 27 going toward "Suur-Paala"

`transport_type`:
- observed values `1,2,3` → likely bus/tram/trolley (need to confirm mapping)

Polling rate: few seconds feels safe. Endpoint is unauthenticated.

### `/siri-stop-departures.php?stopid=<id>` — upcoming departures
Tiny (~175 B typical). CSV-like with header + stop header + rows.

```
Transport,RouteNum,ExpectedTimeInSeconds,ScheduleTimeInSeconds,<epoch>,version20201024
stop,12230
bus,27,44542,44542,Laagri alevik,370,Z
bus,27,46342,46342,Laagri alevik,2170,Z
```

Per row columns:
- transport type (`bus`/`tram`/`trolley`)
- route number
- expected time — seconds since midnight (local time)
- scheduled time — seconds since midnight
- destination name
- **seconds until departure** (the thing to display)
- flag (`Z` live, possibly `S` scheduled?)

Name-based SIRI connection (the stopid is the SiriID from stops). Fast, tiny responses — ideal for polling per shown stop.

## Browser access / CORS

Verified with `Origin:` header on each endpoint:

| Endpoint | `Access-Control-Allow-Origin` | Browser-accessible? |
|---|---|---|
| `/data/gtfs.zip` | absent | N/A — fetched at build time only |
| `/siri-stop-departures.php` | `*` | Yes, directly from any origin |
| `/gps.txt` | absent | **No — needs a proxy** |

So the CORS problem is limited to one endpoint.

## Recommended architecture

No backend needed — pure static + direct CORS-allowed fetches.

1. **Build-time GTFS ingest** — download `gtfs.zip` during `bun run build`, emit a trimmed JSON bundle (routes, stops, shape summaries) into `public/`. Offline-capable via PWA cache.
2. **`/siri-stop-departures.php` direct** — fetch from the client. Tiny responses (~175 B), CORS already `*`. This is the main live data source.
3. **Client** — Vue + daisyUI + Pinia stores for `stops`, `routes`, `departures`. Optional map view via MapLibre or Leaflet.

Live vehicle positions (`/gps.txt`) skipped for now. If we want them later, add a small Cloudflare Worker proxy at that point.

## Open questions

- Confirm `transport_type` mapping in `gps.txt` (1/2/3 → ?)
- Confirm flag column values (`Z`, `false` seen — what's "false"?)
- Confirm timezone / midnight-reference for `ExpectedTimeInSeconds`
- Is there a WebSocket / SSE endpoint for vehicles? (Probably not — poll-based)
- Quota / rate limits on the real-time endpoints? (Unknown; be gentle during dev.)
