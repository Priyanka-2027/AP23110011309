# Notification System Design

---

## Stage 1

### Overview

A campus notification platform that delivers real-time updates to students for Placements, Events, and Results.

### Core Actions

| Action | Description |
|--------|-------------|
| Fetch all notifications | Student retrieves their notifications |
| Fetch unread notifications | Student retrieves only unread notifications |
| Mark notification as read | Student marks one notification as read |
| Mark all as read | Student marks all notifications as read |
| Filter by type | Student filters by Placement / Result / Event |
| Admin: Send notification | Admin broadcasts a notification to all or specific students |

---

### REST API Endpoints

#### 1. Get All Notifications

```
GET /api/notifications
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "notifications": [
    {
      "id": "uuid",
      "type": "Placement",
      "message": "CSX Corporation hiring",
      "isRead": false,
      "timestamp": "2026-04-22T17:51:18Z"
    }
  ]
}
```

---

#### 2. Get Unread Notifications

```
GET /api/notifications/unread
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "unreadCount": 5,
  "notifications": [ ... ]
}
```

---

#### 3. Get Notifications by Type

```
GET /api/notifications/type/:type
```

**Path Params:** `type` = `Placement` | `Result` | `Event`

**Response (200):**
```json
{
  "type": "Placement",
  "count": 3,
  "notifications": [ ... ]
}
```

---

#### 4. Mark Notification as Read

```
PATCH /api/notifications/:id/read
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "message": "Notification marked as read.",
  "notificationId": "uuid"
}
```

---

#### 5. Mark All Notifications as Read

```
PATCH /api/notifications/read-all
```

**Response (200):**
```json
{
  "message": "All notifications marked as read.",
  "updatedCount": 12
}
```

---

#### 6. Admin: Send Notification

```
POST /api/admin/notifications
```

**Request Body:**
```json
{
  "type": "Placement",
  "message": "Google hiring drive on May 10",
  "studentIds": ["id1", "id2"]
}
```

**Response (201):**
```json
{
  "message": "Notification queued for delivery.",
  "notificationId": "uuid"
}
```

---

### Real-Time Notification Mechanism

Use **Server-Sent Events (SSE)** for real-time delivery.

```
GET /api/notifications/stream
```

- Client opens a persistent HTTP connection
- Server pushes new notifications as `text/event-stream`
- Lightweight, works over standard HTTP, no extra protocol needed
- Falls back gracefully if connection drops (client auto-reconnects)

**SSE Event format:**
```
data: {"id":"uuid","type":"Placement","message":"Google hiring","timestamp":"2026-04-22T18:00:00Z"}
```

Alternative: **WebSockets** — better for bidirectional communication but heavier to set up. SSE is preferred here since notifications are server-to-client only.

---

## Stage 2

### Database Choice: PostgreSQL

**Justification:**
- Notifications have a well-defined, consistent schema — relational model fits perfectly
- Need efficient queries by `studentId`, `type`, `isRead`, `createdAt` — SQL handles these with indexes
- ACID compliance ensures no notification is lost or duplicated
- Mature ecosystem, excellent support for JSON columns if schema needs to flex

---

### DB Schema

```sql
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  roll_no VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TYPE notification_type AS ENUM ('Placement', 'Result', 'Event');

-- Indexes for common query patterns
CREATE INDEX idx_notifications_student_id ON notifications(student_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
-- Composite index for the most common query pattern
CREATE INDEX idx_notifications_student_unread ON notifications(student_id, is_read, created_at DESC);
```

---

### Queries Based on Stage 1 APIs

**Fetch all notifications for a student:**
```sql
SELECT * FROM notifications
WHERE student_id = $1
ORDER BY created_at DESC;
```

**Fetch unread notifications:**
```sql
SELECT * FROM notifications
WHERE student_id = $1 AND is_read = FALSE
ORDER BY created_at DESC;
```

**Filter by type:**
```sql
SELECT * FROM notifications
WHERE student_id = $1 AND type = $2
ORDER BY created_at DESC;
```

**Mark one as read:**
```sql
UPDATE notifications
SET is_read = TRUE
WHERE id = $1 AND student_id = $2;
```

**Mark all as read:**
```sql
UPDATE notifications
SET is_read = TRUE
WHERE student_id = $1 AND is_read = FALSE;
```

**Insert a new notification:**
```sql
INSERT INTO notifications (student_id, type, message)
VALUES ($1, $2, $3)
RETURNING id;
```

---

### Scaling Problems and Solutions

| Problem | Solution |
|---------|----------|
| Table grows to billions of rows | **Partitioning** by `created_at` (monthly partitions) — old partitions can be archived |
| Read-heavy load overwhelms DB | **Read replicas** — route all SELECT queries to replicas |
| Slow queries as data grows | **Composite indexes** on `(student_id, is_read, created_at DESC)` |
| Notification fan-out to 50k students is slow | **Message queue** (Redis/RabbitMQ) — async delivery |
| Hot rows on popular students | **Caching** unread counts in Redis with TTL |

---

## Stage 3

### Query Analysis

```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt DESC;
```

**Is this query accurate?**
Yes, it correctly fetches unread notifications for a student ordered by recency.

**Why is it slow?**
1. `SELECT *` fetches all columns including large `message` text — unnecessary data transfer
2. Without an index on `(studentID, isRead, createdAt)`, the DB does a **full table scan** on 5,000,000 rows
3. Sorting 5M rows without an index is O(N log N) on every request

**What to change:**
```sql
-- Only select needed columns
SELECT id, type, message, created_at FROM notifications
WHERE student_id = 1042 AND is_read = FALSE
ORDER BY created_at DESC;
```

**Computation cost after fix:** O(log N) index lookup + O(K log K) sort on K matching rows (K << N)

---

### Should we add indexes on every column?

**No.** This is bad advice.

- Every index adds **write overhead** — every INSERT/UPDATE must update all indexes
- Indexes consume **disk space**
- With 5M rows and frequent writes (50k students getting notifications), indexing every column would severely degrade write performance

**Correct approach:** Index only the columns that appear in WHERE, ORDER BY, and JOIN clauses of frequent queries.

**Recommended indexes:**
```sql
-- Covers the most common query pattern
CREATE INDEX idx_notifications_student_unread_date
ON notifications(student_id, is_read, created_at DESC);

-- For type-based filtering
CREATE INDEX idx_notifications_type ON notifications(type);
```

---

### Query: Students who got a Placement notification in the last 7 days

```sql
SELECT DISTINCT s.id, s.name, s.email
FROM students s
JOIN notifications n ON n.student_id = s.id
WHERE n.type = 'Placement'
  AND n.created_at >= NOW() - INTERVAL '7 days';
```

---

## Stage 4

### Problem
Notifications are fetched from DB on every page load for every student. With 50,000 students, this creates massive read pressure on the database.

### Solutions and Tradeoffs

#### 1. Redis Cache (Recommended)

Cache each student's unread notifications in Redis with a short TTL (e.g., 60 seconds).

```
Key:   notifications:unread:<studentId>
Value: JSON array of notifications
TTL:   60 seconds
```

**Flow:**
- On request: check Redis first → if hit, return cached data
- If miss: query DB, store result in Redis, return data
- On new notification: invalidate that student's cache key

**Tradeoffs:**
- ✅ Dramatically reduces DB reads (cache hit rate ~90%+ for active users)
- ✅ Sub-millisecond response for cached responses
- ❌ Slight staleness (up to TTL seconds)
- ❌ Cache invalidation complexity — must invalidate on new notification or mark-as-read

---

#### 2. Unread Count Cache

Instead of caching full notification lists, cache only the **unread count** per student. The full list is only fetched when the student opens the notification panel.

**Tradeoffs:**
- ✅ Very lightweight — just an integer per student
- ✅ Easy to increment/decrement atomically with Redis INCR/DECR
- ❌ Still requires a DB query when the panel is opened

---

#### 3. Pagination

Never fetch all notifications at once. Use cursor-based pagination.

```
GET /api/notifications?cursor=<lastId>&limit=20
```

**Tradeoffs:**
- ✅ Limits data transferred per request
- ✅ Works well with indexes
- ❌ Doesn't reduce DB hits, just reduces data per hit

---

#### 4. SSE / Push instead of Poll

Instead of fetching on every page load, push new notifications to connected clients via SSE. Client only fetches the initial list once.

**Tradeoffs:**
- ✅ Eliminates polling entirely
- ✅ Real-time delivery
- ❌ Requires persistent connections — more server resources
- ❌ Need a pub/sub layer (Redis pub/sub) to fan out across multiple server instances

---

## Stage 5

### Problem with the current implementation

```python
function notify_all(student_ids: array, message: string):
    for student_id in student_ids:
        send_email(student_id, message)   # calls Email API
        save_to_db(student_id, message)   # DB insert
        push_to_app(student_id, message)  # real-time push
```

**Shortcomings:**
1. **Sequential processing** — 50,000 students processed one by one. At even 100ms per student, this takes ~83 minutes
2. **No error recovery** — if `send_email` fails for student 200, the loop stops. Students 201–50,000 get nothing
3. **Tight coupling** — email, DB save, and push are all in one synchronous block. If DB is slow, email delivery stalls
4. **No retry logic** — transient failures are permanent failures
5. **Atomicity problem** — DB save and email send are not atomic. A student could be saved to DB but email never sent, or vice versa

---

### What happened when 200 emails failed midway?

The loop crashed or skipped. Students 1–199 got emails, students 200 onwards got nothing. The DB may or may not have been updated for those students depending on where exactly the failure occurred.

---

### Should DB save and email send happen together?

**No — they should be decoupled.**

- DB save should happen **first and immediately** — this is the source of truth
- Email send should happen **asynchronously** via a queue
- If email fails, retry from the queue without affecting the DB record

---

### Redesigned Implementation

**Architecture:** Producer → Message Queue → Workers

```
HR clicks "Notify All"
        ↓
API enqueues 50,000 jobs into a message queue (Redis/RabbitMQ)
        ↓
Multiple worker processes consume jobs in parallel
        ↓
Each worker:
  1. save_to_db(student_id, message)     ← immediate, synchronous
  2. push_to_app(student_id, message)    ← real-time SSE push
  3. enqueue email job → Email Worker    ← async, with retry
        ↓
Email Worker:
  - send_email(student_id, message)
  - On failure: retry up to 3 times with exponential backoff
  - On permanent failure: move to dead-letter queue for manual review
```

**Revised Pseudocode:**

```python
function notify_all(student_ids: array, message: string):
    for student_id in student_ids:
        enqueue("notification_jobs", { student_id, message })
    return { status: "queued", count: len(student_ids) }

# Worker (runs in parallel, N instances)
function process_notification_job(job):
    try:
        save_to_db(job.student_id, job.message)
        push_to_app(job.student_id, job.message)
        enqueue("email_jobs", { student_id: job.student_id, message: job.message })
        ack(job)  # mark job as done
    except Exception as e:
        nack(job)  # requeue for retry

# Email Worker (separate, with retry)
function process_email_job(job):
    for attempt in range(3):
        try:
            send_email(job.student_id, job.message)
            ack(job)
            return
        except Exception:
            wait(2 ** attempt seconds)  # exponential backoff
    move_to_dead_letter_queue(job)
```

**Benefits:**
- ✅ Parallel processing — 50k notifications in seconds with multiple workers
- ✅ Email failures don't affect DB saves or app pushes
- ✅ Automatic retry with backoff
- ✅ Dead-letter queue for permanent failures — no silent data loss
- ✅ HR gets immediate response ("queued") — no timeout

---

## Stage 6

### Approach: Min-Heap for Top-N Priority Notifications

**Priority order:** Placement (3) > Result (2) > Event (1)
**Secondary sort:** Recency (newer timestamp wins within same type)

**Algorithm:**
- Assign each notification a score: `score = priorityWeight × 10^13 + timestampMs`
- Use a **min-heap of size N** to maintain top-N efficiently
- For each new notification: push to heap, if size > N, pop the minimum (lowest score)
- Final result: extract all from heap, sort descending

**Time complexity:** O(M log N) where M = total notifications, N = top count
**Space complexity:** O(N)

This is efficient for streaming new notifications — each new notification is processed in O(log N) time without re-sorting the entire list.

**Why not just sort?**
Sorting all M notifications is O(M log M). With a heap, it's O(M log N). When N << M (e.g., top 10 out of 10,000), the heap is significantly faster and handles streaming naturally.

See implementation in `notification_app_be/priority_inbox.js`.
