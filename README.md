# Elevator Simulator

[![CI](https://github.com/vgartg/elevator-simulator/actions/workflows/ci.yml/badge.svg)](https://github.com/vgartg/elevator-simulator/actions/workflows/ci.yml)
[![Go Report Card](https://goreportcard.com/badge/github.com/vgartg/elevator-simulator)](https://goreportcard.com/report/github.com/vgartg/elevator-simulator)
[![Go](https://img.shields.io/badge/Go-1.22%2B-00ADD8?logo=go&logoColor=white)](https://go.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.txt)

---



---

A pet project to practice tick-based simulation, HTTP API design, and small-scale frontend architecture in one repo — a multi-cabin elevator dispatcher with a Go core, a chi-powered JSON API, and a Vite + TypeScript + Tailwind SPA that draws the building floor by floor

## What it does

The Go core models a building with up to eight cabins and twenty floors, each tick closing doors, dispatching pending hall calls by nearest-cost, then advancing each cabin one floor toward the head of its queue using a LOOK/SCAN style scheduler

A thin chi router exposes the simulator over JSON so anything can drive it — `curl`, an integration test, or the bundled SPA, which streams state every tick and lets you place hall calls, pick destinations from inside a cabin, step manually, or run the simulation at four selectable speeds

## Quickstart

### Run the demo from the library

```bash
go run ./cmd/demo
```

Prints a fourteen-tick trace of two cabins answering hall calls and an in-cabin selection — useful as a sanity check that the scheduler does something sensible

### Run the HTTP API

```bash
go run ./cmd/server
# elevator-simulator listening on http://localhost:3000 (floors=10, cabins=2)

curl http://localhost:3000/api/health
curl -X POST http://localhost:3000/api/call \
  -H 'Content-Type: application/json' \
  -d '{"floor":7,"direction":"down"}'
curl -X POST 'http://localhost:3000/api/tick?steps=5'
curl http://localhost:3000/api/state
```

Environment variables `PORT`, `FLOORS`, `ELEVATORS` override the defaults

### Run the SPA

```bash
cd web
npm install
npm run dev
# Local: http://localhost:8080
```

The dev server proxies `/api` to `http://localhost:3000`, so make sure the Go server is running too — production builds land in `web/dist/` and the Go server picks them up automatically when present

## Using the library directly

```go
package main

import (
    "fmt"
    "github.com/vgartg/elevator-simulator/internal/elevator"
)

func main() {
    b, _ := elevator.NewBuilding(10, 2)
    _ = b.Call(5, elevator.DirectionUp)
    _ = b.Select(1, 8)
    for i := 0; i < 12; i++ {
        b.Tick()
    }
    fmt.Printf("%+v\n", b.GetSnapshot().Stats)
}
```

The package exposes `Building`, `Elevator`, `Direction`, `Call`, `Snapshot`, plus a small handful of sentinel errors (`ErrInvalidFloor`, `ErrInvalidElevator`, `ErrInvalidDirection`, `ErrInvalidConfig`) so callers can branch on failure modes without string matching

## HTTP API

Base URL: `http://localhost:3000`

| Method | Path             | Body / query                                | Description                                              |
| ------ | ---------------- | ------------------------------------------- | -------------------------------------------------------- |
| GET    | `/api/health`    | —                                           | Returns `{ "status": "ok", "version": "..." }`           |
| GET    | `/api/config`    | —                                           | Returns the current `{ floors, elevators }`              |
| GET    | `/api/state`     | —                                           | Returns the full building snapshot                       |
| POST   | `/api/call`      | `{"floor": int, "direction": "up"\|"down"}` | Queues a hall call                                       |
| POST   | `/api/select`    | `{"elevatorId": int, "floor": int}`         | Adds an in-cabin destination                             |
| POST   | `/api/tick`      | `?steps=1..200`                             | Advances the simulation N ticks                          |
| POST   | `/api/reset`     | `{"floors": int, "elevators": int}`         | Rebuilds the simulation with new geometry                |

Example response from `GET /api/state`:

```json
{
  "floors": 10,
  "elevators": [
    { "id": 1, "currentFloor": 3, "direction": "up", "doorsOpen": false, "queue": [7] },
    { "id": 2, "currentFloor": 9, "direction": "idle", "doorsOpen": false, "queue": [] }
  ],
  "calls": [],
  "stats": { "ticks": 8, "stopsServed": 2, "callsPlaced": 3, "callsServed": 3 }
}
```

Errors are JSON, with a stable machine-readable `error` code and a human `message`:

```json
{ "error": "invalid_floor", "message": "invalid floor" }
```

## Tooling

| Concern        | Tool                                |
| -------------- | ----------------------------------- |
| Core language  | Go 1.22+                            |
| HTTP router    | chi v5 + CORS middleware            |
| Backend tests  | `go test` + `net/http/httptest`     |
| Frontend stack | Vite 5 + TypeScript 5.6 + Tailwind 3.4 |
| Frontend lint  | ESLint + `@typescript-eslint`       |
| Formatting     | Prettier 3                          |
| Frontend tests | Vitest 2 (jsdom env)                |
| CI             | GitHub Actions, Go 1.22/1.23 × Node 20/22 |
| License        | MIT                                 |

## Project layout in detail

```
.
├── .github/workflows/ci.yml      # lint + test + build for both halves
├── api/
│   ├── server.go                 # chi router, handlers, CORS, SPA fallback
│   ├── fs.go                     # tiny filesystem helper
│   └── server_test.go            # httptest integration coverage
├── cmd/
│   ├── server/main.go            # entry point, listens on :3000
│   └── demo/main.go              # CLI walkthrough of the simulator
├── internal/elevator/
│   ├── model.go                  # Elevator, Direction, Call, Stats
│   ├── building.go               # Building struct + Call/Select
│   ├── simulator.go              # Tick, dispatch, SCAN-style sort
│   └── simulator_test.go         # unit tests on the core
├── web/
│   ├── src/
│   │   ├── main.ts               # page shell, run/step loop, health pill
│   │   ├── api.ts                # typed fetch wrapper with ApiError
│   │   ├── types.ts              # shared snapshot types
│   │   ├── components/
│   │   │   ├── building.ts       # floor rows, shafts, cabin panels
│   │   │   ├── controls.ts       # run/step/speed/reset toolbar
│   │   │   └── toast.ts          # transient notification
│   │   └── style.css             # tailwind layers + reusable components
│   ├── tests/api.test.ts         # vitest specs for the fetch wrapper
│   ├── public/favicon.svg        # Go-cyan building icon
│   ├── index.html
│   ├── vite.config.ts            # port 8080, /api proxy to :3000
│   ├── tailwind.config.js        # Go-cyan palette, custom shadow
│   ├── tsconfig.json
│   └── package.json
├── go.mod
├── go.sum
├── LICENSE.txt
└── README.md
```

## Roadmap

- Visual cabin animation between floors instead of snap-to-grid rendering
- Server-Sent Events stream so the SPA stops polling
- Pluggable schedulers — round-robin and FIFO alongside the default LOOK
- Passenger model with boarding/disembark times instead of instant stops
- Persistent run logs so a session's tick trace can be replayed