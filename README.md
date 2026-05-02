# Campus Hiring Evaluation — Backend

**Company:** Affordmed (Afford Medical Technologies Pvt. Ltd.)  
**Role:** Backend Developer  
**Candidate:** Priyanka Jakkampudi  
**Roll No:** ap23110011309  
**GitHub:** https://github.com/Priyanka-2027/AP23110011309

---

## Overview

This repository contains the complete backend evaluation submission for the Affordmed campus hiring process. The assignment tests real-world backend engineering skills across three areas:

1. **Logging Middleware** — A reusable logging package that sends structured logs to the evaluation server
2. **Vehicle Maintenance Scheduler** — An optimization microservice using the 0/1 Knapsack algorithm
3. **Campus Notifications Microservice** — A full system design + working backend across 6 progressive stages

---

## Repository Structure

```
AP23110011309/
│
├── logging_middleware/
│   ├── index.js                  # Reusable Log() function
│   ├── test.js                   # Test script for the middleware
│   ├── package.json
│   └── logging_test.png          # Screenshot: log created successfully
│
├── vehicle_maintence_scheduler/
│   ├── index.js                  # Main knapsack solver
│   ├── package.json
│   ├── .env                      # AUTH_TOKEN and BASE_URL
│   └── screenshots/
│       ├── output-1.png          # Depot 1 output
│       ├── output-2.png          # Depot 2 output
│       ├── output-3.png          # Depot 3 output
│       ├── output-4.png          # Depot 4 output
│       ├── output-5.png          # Depot 5 output
│       └── output_log.txt        # Full text output of all depots
│
├── notification_app_be/
│   ├── index.js                  # Express REST API server
│   ├── priority_inbox.js         # Stage 6: Priority inbox using min-heap
│   ├── package.json
│   ├── .env                      # AUTH_TOKEN and BASE_URL
│   └── screenshots/
│       ├── health.png            # GET /health
│       ├── all_notifications.png # GET /notifications
│       ├── priority.png          # GET /notifications/priority?n=10
│       ├── unread.png            # GET /notifications/unread
│       ├── type_placement.png    # GET /notifications/type/Placement
│       ├── type_result.png       # GET /notifications/type/Result
│       ├── type_event.png        # GET /notifications/type/Event
│       └── priority_inbox.png    # Terminal output of priority_inbox.js
│
├── notification_system_design.md # All 6 stages of system design
├── get_token.js                  # Helper: fetches a fresh Bearer token
├── .gitignore
└── README.md
```

---

## Pre-Test Setup

### Registration
Registered with the Affordmed evaluation server to obtain a unique `clientID` and `clientSecret`:

```
POST http://20.207.122.201/evaluation-service/register
```

```json
{
  "email": "priyanka_jakkampudi@srmap.edu.in",
  "name": "priyanka jakkampudi",
  "rollNo": "ap23110011309",
  "accessCode": "QkbpxH",
  "githubUsername": "Priyanka-2027"
}
```

### Authentication
Used credentials to obtain a Bearer token:

```
POST http://20.207.122.201/evaluation-service/auth
```

This token is used in the `Authorization: Bearer <token>` header for all protected API calls. The token auto-refreshes on startup and retries on 401 responses.

---

## Part 1 — Logging Middleware

### Location
`logging_middleware/index.js`

### What it does
A reusable `Log(stack, level, package, message, token)` function that sends every log entry as a POST request to the evaluation server instead of using `console.log` or any built-in logger.

```
POST http://20.207.122.201/evaluation-service/logs
Authorization: Bearer <token>

{
  "stack": "backend",
  "level": "info",
  "package": "service",
  "message": "Fetching depots from server."
}
```

### Allowed values

| Field | Values |
|-------|--------|
| stack | `backend`, `frontend` |
| level | `debug`, `info`, `warn`, `error`, `fatal` |
| package (backend) | `cache`, `controller`, `cron_job`, `db`, `domain`, `handler`, `repository`, `route`, `service` |
| package (shared) | `auth`, `config`, `middleware`, `utils` |

### Key features
- Validates all inputs before sending
- Automatically truncates messages longer than 48 characters (API limit)
- Silently fails so logging never crashes the main application
- Used throughout all other code — no `console.log` anywhere

### How to test
```bash
cd logging_middleware
npm install
node test.js
```

Expected output:
```
Testing logging middleware...
Token obtained successfully.
Log response: { logID: 'uuid', message: 'log created successfully' }
```

---

## Part 2 — Vehicle Maintenance Scheduler

### Location
`vehicle_maintence_scheduler/index.js`

### Problem Statement
A logistics company has multiple depots. Each depot has a daily budget of mechanic-hours. There are many vehicle maintenance tasks, each with:
- `Duration` — hours required to complete the task
- `Impact` — importance score of completing the task

**Goal:** For each depot, select the best combination of tasks that maximises total Impact without exceeding the MechanicHours budget.

This is the classic **0/1 Knapsack problem**.

### Data Sources (live APIs — no hardcoding)

**Depots API:**
```
GET http://20.207.122.201/evaluation-service/depots
Authorization: Bearer <token>
```

Response:
```json
{
  "depots": [
    { "ID": 1, "MechanicHours": 60 },
    { "ID": 2, "MechanicHours": 135 },
    { "ID": 3, "MechanicHours": 188 },
    { "ID": 4, "MechanicHours": 97 },
    { "ID": 5, "MechanicHours": 164 }
  ]
}
```

**Vehicles API:**
```
GET http://20.207.122.201/evaluation-service/vehicles
Authorization: Bearer <token>
```

Response:
```json
{
  "vehicles": [
    { "TaskID": "uuid", "Duration": 3, "Impact": 7 },
    ...
  ]
}
```

### Algorithm — Dynamic Programming (0/1 Knapsack)

```
dp[i][w] = maximum impact using first i tasks with w hours available

For each task i and each budget w:
  - Don't take task i: dp[i][w] = dp[i-1][w]
  - Take task i (if it fits): dp[i][w] = max(dp[i][w], dp[i-1][w-duration] + impact)

Backtrack through dp table to find which tasks were selected.
```

**Time complexity:** O(N × W) where N = number of tasks, W = mechanic-hour budget  
**Why DP over greedy?** Greedy (sort by impact/duration ratio) does not guarantee the optimal solution for 0/1 knapsack. DP always finds the true optimum.

### How to run
```bash
cd vehicle_maintence_scheduler
npm install
node index.js
```

### Sample output
```
========================================
Depot ID       : 1
Budget (hrs)   : 60
Hours Used     : 60
Total Impact   : 119
Tasks Scheduled: 18
Tasks:
  - TaskID: bb68e6db-... | Duration: 1h | Impact: 5
  - TaskID: 82ab765f-... | Duration: 4h | Impact: 8
  ...
========================================
All depots processed successfully.
```

---

## Part 3 — Campus Notifications Microservice

### Location
`notification_app_be/index.js`  
`notification_app_be/priority_inbox.js`  
`notification_system_design.md`

### Problem Statement
Build a backend system for a campus notification platform where students receive real-time updates about Placements, Events, and Results. This is split into 6 progressive stages.

---

### REST API Server

**How to run:**
```bash
cd notification_app_be
npm install
node index.js
# Server starts on http://localhost:3000
```

**Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check — returns status and timestamp |
| GET | `/notifications` | All notifications from the evaluation server |
| GET | `/notifications/unread` | All notifications sorted by recency (newest first) |
| GET | `/notifications/priority?n=10` | Top N notifications by priority + recency |
| GET | `/notifications/type/:type` | Filter by `Placement`, `Result`, or `Event` |

**Data source:**
```
GET http://20.207.122.201/evaluation-service/notifications
Authorization: Bearer <token>
```

Each notification has:
```json
{
  "ID": "uuid",
  "Type": "Placement | Result | Event",
  "Message": "string",
  "Timestamp": "2026-04-22 17:51:30"
}
```

---

### Stage 6 — Priority Inbox

**Location:** `notification_app_be/priority_inbox.js`

**How to run:**
```bash
cd notification_app_be
node priority_inbox.js 10    # top 10
node priority_inbox.js 20    # top 20
```

**Priority order:** Placement (3) > Result (2) > Event (1)  
**Secondary sort:** Newer timestamp wins within the same type

**Algorithm — Min-Heap (O(M log N))**

Each notification gets a score:
```
score = priorityWeight × 10^13 + timestampMilliseconds
```

A min-heap of size N is maintained as notifications are processed:
- Push each notification onto the heap
- If heap size exceeds N, pop the minimum (lowest score) — evicting the least important
- Final result: extract all from heap, sort descending

**Why min-heap over sorting?**
- Sorting all M notifications: O(M log M)
- Min-heap of size N: O(M log N)
- When N << M (e.g., top 10 out of 10,000), heap is significantly faster
- Handles streaming new notifications naturally — each new item processed in O(log N)

**Sample output:**
```
Top 10 Priority Notifications (Placement > Result > Event, then by recency):

Rank | Type       | Message                          | Timestamp
-----|------------|----------------------------------|--------------------
   1 | Placement  | Advanced Micro Devices Inc. hiri | 2026-05-02 04:30:27
   2 | Placement  | Booking Holdings Inc. hiring     | 2026-05-01 14:30:03
   3 | Placement  | Advanced Micro Devices Inc. hiri | 2026-05-01 08:29:39
   4 | Result     | end-sem                          | 2026-05-02 05:59:27
   5 | Result     | external                         | 2026-05-02 03:29:57
   ...
Total fetched: 20 | Displayed: 10
```

---

### System Design (All 6 Stages)

Full design is in `notification_system_design.md`. Summary:

| Stage | What it covers |
|-------|----------------|
| **Stage 1** | REST API design — endpoints, JSON schemas, real-time via SSE |
| **Stage 2** | PostgreSQL chosen, schema design, queries for all Stage 1 APIs, scaling strategies |
| **Stage 3** | Slow query analysis, indexing strategy, optimised queries |
| **Stage 4** | Redis caching, pagination, SSE push — performance strategies with tradeoffs |
| **Stage 5** | Redesign of sequential notify_all using message queues, parallel workers, retry with exponential backoff |
| **Stage 6** | Min-heap priority inbox implementation with explanation |

---

## Token Management

The evaluation server issues short-lived JWT tokens (~15 minutes). All services handle this automatically:

- **On startup:** Always fetch a fresh token before doing anything
- **On 401 response:** Automatically refresh token and retry the request once
- **Manual refresh:** Run `node get_token.js` from the root folder anytime

---

## Constraints Followed

- No `console.log` or built-in loggers — all logging goes through the custom `Log()` middleware
- No user registration or login in the application — users are assumed pre-authorised
- No hardcoded task/notification data — all data fetched live from evaluation APIs
- No external algorithm libraries — knapsack DP and min-heap implemented from scratch
- Production-grade code: proper naming conventions, structured folders, descriptive comments throughout
