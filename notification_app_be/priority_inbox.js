require("dotenv").config();
const axios = require("axios");
const { Log } = require("../logging_middleware/index");

const TOKEN = process.env.AUTH_TOKEN;
const BASE_URL = process.env.BASE_URL;

const PRIORITY_WEIGHT = {
  Placement: 3,
  Result: 2,
  Event: 1,
};

/**
 * Min-heap implementation to efficiently maintain top-N notifications.
 * Heap is ordered by score (priority weight + recency) ascending,
 * so we can quickly evict the lowest-scored item when heap exceeds N.
 */
class MinHeap {
  constructor(compareFn) {
    this.heap = [];
    this.compare = compareFn;
  }

  size() {
    return this.heap.length;
  }

  peek() {
    return this.heap[0];
  }

  push(item) {
    this.heap.push(item);
    this._bubbleUp(this.heap.length - 1);
  }

  pop() {
    const top = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  _bubbleUp(i) {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.compare(this.heap[i], this.heap[parent]) < 0) {
        [this.heap[i], this.heap[parent]] = [this.heap[parent], this.heap[i]];
        i = parent;
      } else break;
    }
  }

  _sinkDown(i) {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.compare(this.heap[left], this.heap[smallest]) < 0) smallest = left;
      if (right < n && this.compare(this.heap[right], this.heap[smallest]) < 0) smallest = right;
      if (smallest !== i) {
        [this.heap[i], this.heap[smallest]] = [this.heap[smallest], this.heap[i]];
        i = smallest;
      } else break;
    }
  }
}

/**
 * Compute a numeric score for a notification.
 * Higher priority type = higher score.
 * More recent timestamp = higher score (unix ms).
 * We combine them: score = priorityWeight * 1e13 + timestampMs
 * This ensures type priority always dominates over recency.
 */
function score(notification) {
  const weight = PRIORITY_WEIGHT[notification.Type] || 0;
  const ts = new Date(notification.Timestamp).getTime();
  return weight * 1e13 + ts;
}

/**
 * Get top N notifications using a min-heap for efficiency.
 * Time complexity: O(M log N) where M = total notifications, N = top count.
 * This is efficient even as new notifications stream in.
 *
 * @param {Array} notifications - All notifications
 * @param {number} n            - How many top notifications to return
 * @returns {Array}             - Top N notifications sorted highest priority first
 */
function getTopN(notifications, n) {
  // Min-heap: smallest score at top, so we evict lowest when size > n
  const heap = new MinHeap((a, b) => score(a) - score(b));

  for (const notif of notifications) {
    heap.push(notif);
    if (heap.size() > n) {
      heap.pop(); // remove the lowest-scored notification
    }
  }

  // Extract all from heap and sort descending (highest priority first)
  const result = [];
  while (heap.size() > 0) {
    result.push(heap.pop());
  }
  return result.reverse(); // highest score first
}

async function main() {
  const n = parseInt(process.argv[2]) || 10;

  await Log("backend", "info", "service", `Priority Inbox started. Fetching top ${n} notifications.`, TOKEN);

  try {
    const response = await axios.get(`${BASE_URL}/notifications`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });

    const notifications = response.data.notifications;
    await Log("backend", "info", "service", `Fetched ${notifications.length} notifications from server.`, TOKEN);

    const topN = getTopN(notifications, n);

    await Log(
      "backend",
      "info",
      "domain",
      `Computed top ${topN.length} priority notifications using min-heap (O(M log N)).`,
      TOKEN
    );

    console.log(`\nTop ${n} Priority Notifications (Placement > Result > Event, then by recency):\n`);
    console.log("Rank | Type       | Message                          | Timestamp");
    console.log("-----|------------|----------------------------------|--------------------");
    topN.forEach((notif, i) => {
      console.log(
        `${String(i + 1).padStart(4)} | ${notif.Type.padEnd(10)} | ${notif.Message.padEnd(32)} | ${notif.Timestamp}`
      );
    });

    console.log(`\nTotal fetched: ${notifications.length} | Displayed: ${topN.length}`);
  } catch (err) {
    await Log("backend", "fatal", "service", `Priority Inbox failed: ${err.message}`, TOKEN);
    console.error("Error:", err.message);
    process.exit(1);
  }
}

main();
