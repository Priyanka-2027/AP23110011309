require("dotenv").config();
const express = require("express");
const axios = require("axios");
const { Log } = require("../logging_middleware/index");

const app = express();
app.use(express.json());

const TOKEN = process.env.AUTH_TOKEN;
const BASE_URL = process.env.BASE_URL;
const PORT = process.env.PORT || 3000;

const authHeaders = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

// Priority weights for notification types
const PRIORITY_WEIGHT = {
  Placement: 3,
  Result: 2,
  Event: 1,
};

/**
 * Fetch all notifications from the evaluation server.
 */
async function fetchNotifications() {
  await Log("backend", "info", "service", "Fetching notifications from server.", TOKEN);
  const response = await axios.get(`${BASE_URL}/notifications`, { headers: authHeaders });
  await Log("backend", "info", "service", `Fetched ${response.data.notifications.length} notifications.`, TOKEN);
  return response.data.notifications;
}

/**
 * GET /notifications
 * Returns all notifications fetched from the evaluation server.
 */
app.get("/notifications", async (req, res) => {
  await Log("backend", "info", "route", "GET /notifications called.", TOKEN);
  try {
    const notifications = await fetchNotifications();
    await Log("backend", "info", "controller", `Returning ${notifications.length} notifications.`, TOKEN);
    res.json({ notifications });
  } catch (err) {
    await Log("backend", "error", "controller", `GET /notifications failed.`, TOKEN);
    res.status(500).json({ error: "Failed to fetch notifications." });
  }
});

/**
 * GET /notifications/priority?n=10
 * Returns top N notifications sorted by priority (Placement > Result > Event)
 * and recency (newer first within same priority).
 */
app.get("/notifications/priority", async (req, res) => {
  const n = parseInt(req.query.n) || 10;
  await Log("backend", "info", "route", `GET /notifications/priority n=${n}.`, TOKEN);

  try {
    const notifications = await fetchNotifications();

    const sorted = notifications.sort((a, b) => {
      const weightDiff = (PRIORITY_WEIGHT[b.Type] || 0) - (PRIORITY_WEIGHT[a.Type] || 0);
      if (weightDiff !== 0) return weightDiff;
      return new Date(b.Timestamp) - new Date(a.Timestamp);
    });

    const topN = sorted.slice(0, n);

    await Log("backend", "info", "controller", `Returning top ${topN.length} priority notifications.`, TOKEN);

    res.json({
      requested: n,
      returned: topN.length,
      notifications: topN,
    });
  } catch (err) {
    await Log("backend", "error", "controller", `Priority fetch failed.`, TOKEN);
    res.status(500).json({ error: "Failed to compute priority notifications." });
  }
});

/**
 * GET /notifications/unread
 * Simulates fetching unread notifications (all fetched notifications treated as unread
 * since there is no persistent DB in this evaluation context).
 */
app.get("/notifications/unread", async (req, res) => {
  await Log("backend", "info", "route", "GET /notifications/unread called.", TOKEN);
  try {
    const notifications = await fetchNotifications();
    const sorted = notifications.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));
    await Log("backend", "info", "controller", `Returning ${sorted.length} unread notifications.`, TOKEN);
    res.json({ notifications: sorted });
  } catch (err) {
    await Log("backend", "error", "controller", "Unread fetch failed.", TOKEN);
    res.status(500).json({ error: "Failed to fetch unread notifications." });
  }
});

/**
 * GET /notifications/type/:type
 * Filter notifications by type: Placement | Result | Event
 */
app.get("/notifications/type/:type", async (req, res) => {
  const { type } = req.params;
  await Log("backend", "info", "route", `GET /notifications/type/${type} called.`, TOKEN);

  const validTypes = ["Placement", "Result", "Event"];
  if (!validTypes.includes(type)) {
    await Log("backend", "warn", "handler", `Invalid notification type requested: ${type}`, TOKEN);
    return res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(", ")}` });
  }

  try {
    const notifications = await fetchNotifications();
    const filtered = notifications
      .filter((n) => n.Type === type)
      .sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));

    await Log("backend", "info", "controller", `Returning ${filtered.length} notifications of type ${type}.`, TOKEN);
    res.json({ type, count: filtered.length, notifications: filtered });
  } catch (err) {
    await Log("backend", "error", "controller", `Failed to filter notifications by type: ${err.message}`, TOKEN);
    res.status(500).json({ error: "Failed to filter notifications." });
  }
});

/**
 * GET /health
 * Health check endpoint.
 */
app.get("/health", async (req, res) => {
  await Log("backend", "info", "route", "GET /health called.", TOKEN);
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, async () => {
  await Log("backend", "info", "config", `Notification service started on port ${PORT}.`, TOKEN);
  console.log(`Notification service running on http://localhost:${PORT}`);
});
