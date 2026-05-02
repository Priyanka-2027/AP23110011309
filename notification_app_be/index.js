require("dotenv").config();
const express = require("express");
const axios = require("axios");
const { Log } = require("../logging_middleware/index");

const app = express();
app.use(express.json());

const BASE_URL = process.env.BASE_URL || "http://20.207.122.201/evaluation-service";
const PORT = process.env.PORT || 3000;

// Token state — refreshed automatically
let AUTH_TOKEN = process.env.AUTH_TOKEN;

const AUTH_CREDS = {
  email: "priyanka_jakkampudi@srmap.edu.in",
  name: "priyanka jakkampudi",
  rollNo: "ap23110011309",
  accessCode: "QkbpxH",
  clientID: "936a1601-9979-448c-9e9d-d45682b9a3b8",
  clientSecret: "PZkCSnVafJJfzpfW",
};

/**
 * Fetch a fresh Bearer token from the auth endpoint.
 */
async function refreshToken() {
  try {
    const response = await axios.post(`${BASE_URL}/auth`, AUTH_CREDS);
    AUTH_TOKEN = response.data.access_token;
    console.log("[Auth] Token refreshed successfully.");
    return AUTH_TOKEN;
  } catch (err) {
    console.error("[Auth] Token refresh failed:", err.response?.status, JSON.stringify(err.response?.data) || err.message);
    throw err;
  }
}

/**
 * Make an authenticated GET request, auto-refreshing token on 401.
 */
async function authGet(url) {
  try {
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    });
    return response.data;
  } catch (err) {
    if (err.response?.status === 401) {
      await refreshToken();
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
      });
      return response.data;
    }
    throw err;
  }
}

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
  await Log("backend", "info", "service", "Fetching notifications from server.", AUTH_TOKEN);
  const data = await authGet(`${BASE_URL}/notifications`);
  await Log("backend", "info", "service", `Fetched ${data.notifications.length} notifications.`, AUTH_TOKEN);
  return data.notifications;
}

/**
 * GET /notifications
 * Returns all notifications fetched from the evaluation server.
 */
app.get("/notifications", async (req, res) => {
  await Log("backend", "info", "route", "GET /notifications called.", AUTH_TOKEN);
  try {
    const notifications = await fetchNotifications();
    await Log("backend", "info", "controller", `Returning ${notifications.length} notifications.`, AUTH_TOKEN);
    res.json({ notifications });
  } catch (err) {
    await Log("backend", "error", "controller", `GET /notifications failed.`, AUTH_TOKEN);
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
  await Log("backend", "info", "route", `GET /notifications/priority n=${n}.`, AUTH_TOKEN);

  try {
    const notifications = await fetchNotifications();

    const sorted = notifications.sort((a, b) => {
      const weightDiff = (PRIORITY_WEIGHT[b.Type] || 0) - (PRIORITY_WEIGHT[a.Type] || 0);
      if (weightDiff !== 0) return weightDiff;
      return new Date(b.Timestamp) - new Date(a.Timestamp);
    });

    const topN = sorted.slice(0, n);

    await Log("backend", "info", "controller", `Returning top ${topN.length} priority notifications.`, AUTH_TOKEN);

    res.json({
      requested: n,
      returned: topN.length,
      notifications: topN,
    });
  } catch (err) {
    await Log("backend", "error", "controller", `Priority fetch failed.`, AUTH_TOKEN);
    res.status(500).json({ error: "Failed to compute priority notifications." });
  }
});

/**
 * GET /notifications/unread
 * Simulates fetching unread notifications (all fetched notifications treated as unread
 * since there is no persistent DB in this evaluation context).
 */
app.get("/notifications/unread", async (req, res) => {
  await Log("backend", "info", "route", "GET /notifications/unread called.", AUTH_TOKEN);
  try {
    const notifications = await fetchNotifications();
    const sorted = notifications.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));
    await Log("backend", "info", "controller", `Returning ${sorted.length} unread notifications.`, AUTH_TOKEN);
    res.json({ notifications: sorted });
  } catch (err) {
    await Log("backend", "error", "controller", "Unread fetch failed.", AUTH_TOKEN);
    res.status(500).json({ error: "Failed to fetch unread notifications." });
  }
});

/**
 * GET /notifications/type/:type
 * Filter notifications by type: Placement | Result | Event
 */
app.get("/notifications/type/:type", async (req, res) => {
  const { type } = req.params;
  await Log("backend", "info", "route", `GET /notifications/type/${type}.`, AUTH_TOKEN);

  const validTypes = ["Placement", "Result", "Event"];
  if (!validTypes.includes(type)) {
    await Log("backend", "warn", "handler", `Invalid type requested: ${type}`, AUTH_TOKEN);
    return res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(", ")}` });
  }

  try {
    const notifications = await fetchNotifications();
    const filtered = notifications
      .filter((n) => n.Type === type)
      .sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));

    await Log("backend", "info", "controller", `Returning ${filtered.length} of type ${type}.`, AUTH_TOKEN);
    res.json({ type, count: filtered.length, notifications: filtered });
  } catch (err) {
    await Log("backend", "error", "controller", `Type filter failed: ${type}`, AUTH_TOKEN);
    res.status(500).json({ error: "Failed to filter notifications." });
  }
});

/**
 * GET /health
 * Health check endpoint.
 */
app.get("/health", async (req, res) => {
  await Log("backend", "info", "route", "GET /health called.", AUTH_TOKEN);
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Start server — refresh token first, then listen
refreshToken().then(() => {
  app.listen(PORT, async () => {
    await Log("backend", "info", "config", `Notification service on port ${PORT}.`, AUTH_TOKEN);
    console.log(`Notification service running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error("Failed to start: could not get auth token.", err.message);
  process.exit(1);
});
