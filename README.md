# Campus Hiring Evaluation — Backend Assignment

**Company:** Affordmed (Afford Medical Technologies Pvt. Ltd.)
**Track:** Backend
**Candidate:** Priyanka Jakkampudi | Roll No: ap23110011309

---

## What This Assignment Is

This is a backend engineering evaluation given during campus placement. It tests real-world backend skills across three areas:

1. **Authentication & Logging** — Register with a test server, get a Bearer token, and build a reusable logging middleware that sends structured logs to the server on every significant operation.
2. **Algorithm Problem (Vehicle Maintenance Scheduler)** — Solve a classic optimization problem (0/1 Knapsack) by fetching real data from protected APIs and computing the best task schedule for each depot.
3. **System Design + Code (Campus Notifications Microservice)** — Design a full notification platform across 6 progressive stages, from API design to database schema, query optimization, caching strategy, async processing, and a working priority inbox implementation.

Everything is submitted to a single public GitHub repository. Frequent commits are required — a single end-of-test commit results in a lower score.

---

## Repository Structure

```
ap23110011309/
├── logging_middleware/              # Reusable logging package (Pre-Test Setup)
│   ├── index.js                     # Log() function — posts logs to eval server
│   ├── package.json
│   └── test.js                      # Quick test for the middleware
│
├── vehicle_maintence_scheduler/     # Task 1: Knapsack optimization microservice
│   ├── index.js                     # Main solver — fetches data, runs knapsack, prints results
│   ├── package.json
│   └── .env                         # AUTH_TOKEN and BASE_URL
│
├── notification_app_be/             # Task 2: Campus Notifications backend
│   ├── index.js                     # Express REST API server
│   ├── priority_inbox.js            # Stage 6: standalone priority inbox script
│   ├── package.json
│   └── .env                         # AUTH_TOKEN and BASE_URL
│
├── notification_system_design.md    # Task 2: All 6 stages of system design
├── get_token.js                     # Helper: fetches a fresh Bearer token
├── .gitignore
└── README.md
```

---

## Pre-Test Setup — Logging Middleware

Before any code was written, the following steps were completed:

### 1. Registration
Called the registration API once to obtain a unique `clientID` and `clientSecret`:
```
POST http://20.207.122.201/evaluation-service/register
```
```json
{
  "email": "priyanka_jakkampudi@srmap.edu.in",
  "name": "priyanka jakkampudi",
  "mobileNo": "<mobile>",
  "githubUsername": "<github-username>",
  "rollNo": "ap23110011309",
  "accessCode": "QkbpxH"
}
```

### 2. Authentication
Used the credentials to get a Bearer token:
```
POST http://20.207.122.201/evaluation-service/auth
```
Returns a JWT Bearer token used in the `Authorization` header for all protected API calls.

### 3. Logging Middleware
Built a reusable `Log(stack, level, package, message, token)` function in `logging_middleware/index.js`.

Every time it is called, it sends a POST request to:
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

**Allowed values (all lowercase):**

| Field   | Allowed Values |
|---------|----------------|
| stack   | `backend`, `frontend` |
| level   | `debug`, `info`, `warn`, `error`, `fatal` |
| package (backend) | `cache`, `controller`, `cron_job`, `db`, `domain`, `handler`, `repository`, `route`, `service` |
| package (shared)  | `auth`, `config`, `middleware`, `utils` |

This middleware is imported and used throughout all other code. No `console.log` or built-in loggers are used anywhere.

---

## Task 1 — Vehicle Maintenance Scheduler

### Problem Statement
A logistics company has multiple depots. Each depot has a daily budget of mechanic-hours. There are many vehicle maintenance tasks, each with a `Duration` (hours needed) and an `Impact` score (how important it is). The goal is to pick the best combination of tasks for each depot that:
- Does **not exceed** the depot's mechanic-hour budget
- **Maximises** the total impact score

This is the classic **0/1 Knapsack problem**.

### Data Source
Data is fetched live from two protected APIs (no hardcoding, no database):

**Depots API:**
```
GET http://20.207.122.201/evaluation-service/depots
Authorization: Bearer <token>
```
Returns depots with their mechanic-hour budgets:
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
Returns tasks with their duration and impact:
```json
{
  "vehicles": [
    { "TaskID": "uuid", "Duration": 3, "Impact": 7 },
    ...
  ]
}
```

### Algorithm
A standard bottom-up dynamic programming knapsack is used:
- `dp[i][w]` = maximum impact achievable using the first `i` tasks with `w` hours available
- After filling the DP table, backtrack to find which tasks were selected
- Time complexity: **O(N × W)** where N = number of tasks, W = mechanic-hour budget

### How to Run
```bash
cd vehicle_maintence_scheduler
npm install
node index.js
```

The script auto-fetches a fresh token, fetches depots and vehicles, runs the knapsack for each depot, and prints the optimal schedule.

### Sample Output
```
========================================
Depot ID       : 1
Budget (hrs)   : 60
Hours Used     : 59
Total Impact   : 109
Tasks Scheduled: 15
Tasks:
  - TaskID: 05f80a9c-... | Duration: 3h | Impact: 7
  - TaskID: 300c8465-... | Duration: 7h | Impact: 9
  ...
========================================
All depots processed successfully.
```

---

## Task 2 — Campus Notifications Microservice

### Problem Statement
Build a backend system for a campus notification platform where students receive real-time updates about Placements, Events, and Results. This task is split into 6 progressive stages.

### Stage Overview

| Stage | Type | What It Covers |
|-------|------|----------------|
| 1 | Design | REST API design, JSON schemas, real-time mechanism |
| 2 | Design | Database choice, schema, queries, scaling |
| 3 | Design | Query analysis, indexing strategy, optimisation |
| 4 | Design | Caching and performance strategies |
| 5 | Design | Async processing, fault tolerance, queue-based redesign |
| 6 | Code   | Working priority inbox using a min-heap |

Full design responses are in `notification_system_design.md`.

---

### REST API (Express Server)

The notification backend runs on port 3000 and exposes these endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/notifications` | All notifications |
| GET | `/notifications/unread` | All notifications sorted by recency |
| GET | `/notifications/priority?n=10` | Top N by priority + recency |
| GET | `/notifications/type/:type` | Filter by `Placement`, `Result`, or `Event` |

Data is fetched live from:
```
GET http://20.207.122.201/evaluation-service/notifications
Authorization: Bearer <token>
```

### How to Run
```bash
cd notification_app_be
npm install
node index.js
# Server starts on http://localhost:3000
```

### Stage 6 — Priority Inbox

Fetches all notifications and returns the top N by priority using a **min-heap** (O(M log N)):

- Priority order: **Placement (3) > Result (2) > Event (1)**
- Within the same type, **newer notifications rank higher**
- Score formula: `score = priorityWeight × 10^13 + timestampMs`
- A min-heap of size N is maintained — when it exceeds N, the lowest-scored item is evicted

This approach handles streaming new notifications efficiently without re-sorting the full list each time.

```bash
cd notification_app_be
node priority_inbox.js 10   # get top 10
node priority_inbox.js 20   # get top 20
```

**Sample Output:**
```
Top 10 Priority Notifications (Placement > Result > Event, then by recency):

Rank | Type       | Message                          | Timestamp
-----|------------|----------------------------------|--------------------
   1 | Placement  | Booking Holdings Inc. hiring     | 2026-05-01 23:44:21
   2 | Placement  | Eli Lilly and Company hiring     | 2026-05-01 23:43:57
   3 | Placement  | Amazon.com Inc. hiring           | 2026-05-01 18:14:09
   ...
   8 | Result     | end-sem                          | 2026-05-02 00:13:39
   9 | Result     | end-sem                          | 2026-05-01 22:44:03
  10 | Result     | internal                         | 2026-05-01 18:13:27
```

---

## Key Technical Decisions

### Why 0/1 Knapsack (DP) for the scheduler?
The problem is exactly the knapsack problem — tasks are either included or not (no partial scheduling), and we want to maximise impact within a fixed budget. DP gives the **optimal solution** in polynomial time. Greedy approaches (e.g., sort by impact/duration ratio) do not guarantee optimality for 0/1 knapsack.

### Why SSE for real-time notifications?
Server-Sent Events are one-directional (server → client), which is exactly what notifications require. They work over standard HTTP, require no extra protocol, and clients auto-reconnect on disconnect. WebSockets would add unnecessary complexity for a read-only notification stream.

### Why PostgreSQL for the notification database?
Notifications have a fixed, well-defined schema. SQL gives efficient indexed queries on `student_id`, `is_read`, `type`, and `created_at`. ACID compliance ensures no notification is lost. A composite index on `(student_id, is_read, created_at DESC)` makes the most common query (unread notifications for a student) very fast.

### Why a message queue for notify_all?
Sending 50,000 emails sequentially in a loop is slow (~83 minutes at 100ms/email) and has no fault tolerance. A queue decouples the API response from the actual delivery, allows parallel workers, and enables automatic retry with exponential backoff on failure.

### Why a min-heap for the priority inbox?
Sorting all M notifications is O(M log M). A min-heap of size N processes M notifications in O(M log N). When N << M (e.g., top 10 out of 10,000), this is significantly faster and naturally handles streaming new notifications — each new item is processed in O(log N) without touching the rest.

---

## Token Management

The evaluation server issues short-lived JWT tokens (~15 minutes). Both the scheduler and notification server automatically fetch a fresh token on startup and retry with a new token on any 401 response. A standalone helper is also provided:

```bash
node get_token.js   # prints a fresh token to the console
```

---

## Constraints Followed

- No `console.log` or built-in loggers — all logging goes through the custom `Log()` middleware
- No user registration or login in the application — users are assumed pre-authorised
- No hardcoded data — all task and notification data is fetched live from the evaluation APIs
- No external algorithm libraries — knapsack and min-heap are implemented from scratch
- Production-grade code standards: proper naming, structured folders, descriptive comments
