require("dotenv").config();
const axios = require("axios");
const { Log } = require("../logging_middleware/index");

const BASE_URL = process.env.BASE_URL;
let TOKEN = process.env.AUTH_TOKEN;

const AUTH_CREDS = {
  email: "priyanka_jakkampudi@srmap.edu.in",
  name: "priyanka jakkampudi",
  rollNo: "ap23110011309",
  accessCode: "QkbpxH",
  clientID: "936a1601-9979-448c-9e9d-d45682b9a3b8",
  clientSecret: "PZkCSnVafJJfzpfW",
};

async function refreshToken() {
  const response = await axios.post(`${BASE_URL}/auth`, AUTH_CREDS);
  TOKEN = response.data.access_token;
  console.log("[Auth] Token refreshed.");
  return TOKEN;
}

async function authGet(url) {
  try {
    return await axios.get(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  } catch (err) {
    if (err.response?.status === 401) {
      await refreshToken();
      return await axios.get(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
    }
    throw err;
  }
}

/**
 * Fetch all depots from the evaluation server.
 * Each depot has: { ID, MechanicHours }
 */
async function fetchDepots() {
  await Log("backend", "info", "service", "Fetching depots from server.", TOKEN);
  try {
    const response = await authGet(`${BASE_URL}/depots`);
    await Log("backend", "info", "service", `Fetched ${response.data.depots.length} depots.`, TOKEN);
    return response.data.depots;
  } catch (err) {
    await Log("backend", "error", "service", `Depot fetch failed: ${err.message}`.substring(0, 48), TOKEN);
    throw err;
  }
}

async function fetchVehicles() {
  await Log("backend", "info", "service", "Fetching vehicles from server.", TOKEN);
  try {
    const response = await authGet(`${BASE_URL}/vehicles`);
    await Log("backend", "info", "service", `Fetched ${response.data.vehicles.length} vehicles.`, TOKEN);
    return response.data.vehicles;
  } catch (err) {
    await Log("backend", "error", "service", `Vehicle fetch failed: ${err.message}`.substring(0, 48), TOKEN);
    throw err;
  }
}

/**
 * 0/1 Knapsack algorithm.
 * Selects tasks to maximise total Impact without exceeding MechanicHours budget.
 *
 * @param {Array} tasks   - Array of { TaskID, Duration, Impact }
 * @param {number} budget - Available mechanic hours (capacity)
 * @returns {{ selectedTasks: Array, totalImpact: number, totalDuration: number }}
 */
function knapsack(tasks, budget) {
  const n = tasks.length;
  // dp[i][w] = max impact using first i tasks with w hours budget
  const dp = Array.from({ length: n + 1 }, () => new Array(budget + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    const { Duration, Impact } = tasks[i - 1];
    for (let w = 0; w <= budget; w++) {
      // Don't take task i
      dp[i][w] = dp[i - 1][w];
      // Take task i if it fits
      if (Duration <= w) {
        dp[i][w] = Math.max(dp[i][w], dp[i - 1][w - Duration] + Impact);
      }
    }
  }

  // Backtrack to find which tasks were selected
  const selectedTasks = [];
  let w = budget;
  for (let i = n; i > 0; i--) {
    if (dp[i][w] !== dp[i - 1][w]) {
      selectedTasks.push(tasks[i - 1]);
      w -= tasks[i - 1].Duration;
    }
  }

  return {
    selectedTasks: selectedTasks.reverse(),
    totalImpact: dp[n][budget],
    totalDuration: selectedTasks.reduce((sum, t) => sum + t.Duration, 0),
  };
}

/**
 * Main entry point.
 * For each depot, runs the knapsack algorithm and prints the optimal schedule.
 */
async function main() {
  await refreshToken();
  await Log("backend", "info", "service", "Vehicle Maintenance Scheduler started.", TOKEN);

  try {
    const [depots, vehicles] = await Promise.all([fetchDepots(), fetchVehicles()]);

    await Log("backend", "info", "domain", `Processing ${depots.length} depots, ${vehicles.length} tasks.`, TOKEN);

    const results = [];

    for (const depot of depots) {
      await Log("backend", "info", "domain", `Knapsack: Depot ${depot.ID}, budget ${depot.MechanicHours}h.`, TOKEN);

      const { selectedTasks, totalImpact, totalDuration } = knapsack(vehicles, depot.MechanicHours);

      const result = {
        depotID: depot.ID,
        mechanicHoursBudget: depot.MechanicHours,
        totalDurationScheduled: totalDuration,
        totalImpactScore: totalImpact,
        scheduledTasks: selectedTasks.map((t) => ({
          TaskID: t.TaskID,
          Duration: t.Duration,
          Impact: t.Impact,
        })),
      };

      results.push(result);

      await Log(
        "backend",
        "info",
        "domain",
        `Depot ${depot.ID}: impact=${totalImpact}, hrs=${totalDuration}/${depot.MechanicHours}.`,
        TOKEN
      );

      console.log("\n========================================");
      console.log(`Depot ID       : ${depot.ID}`);
      console.log(`Budget (hrs)   : ${depot.MechanicHours}`);
      console.log(`Hours Used     : ${totalDuration}`);
      console.log(`Total Impact   : ${totalImpact}`);
      console.log(`Tasks Scheduled: ${selectedTasks.length}`);
      console.log("Tasks:");
      selectedTasks.forEach((t) => {
        console.log(`  - TaskID: ${t.TaskID} | Duration: ${t.Duration}h | Impact: ${t.Impact}`);
      });
    }

    console.log("\n========================================");
    console.log("All depots processed successfully.");
    await Log("backend", "info", "service", "Scheduler completed successfully.", TOKEN);

    return results;
  } catch (err) {
    await Log("backend", "fatal", "service", `Scheduler error: ${err.message}`.substring(0, 48), TOKEN);
    console.error("Fatal error:", err.message);
    process.exit(1);
  }
}

main();
