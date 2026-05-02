/**
 * Run this script to get a fresh Bearer token.
 * Usage: node get_token.js
 * Copy the access_token from the output and update your .env files.
 */
const axios = require("axios");

async function getToken() {
  try {
    const response = await axios.post("http://20.207.122.201/evaluation-service/auth", {
      email: "priyanka_jakkampudi@srmap.edu.in",
      name: "priyanka jakkampudi",
      rollNo: "ap23110011309",
      accessCode: "QkbpxH",
      clientID: "936a1601-9979-448c-9e9d-d45682b9a3b8",
      clientSecret: "PZkCSnVafJJfzpfW",
    });

    const token = response.data.access_token;
    console.log("\n✅ Fresh token obtained!\n");
    console.log("TOKEN:", token);
    console.log("\nCopy the above token and update AUTH_TOKEN in:");
    console.log("  - vehicle_maintence_scheduler/.env");
    console.log("  - notification_app_be/.env");
  } catch (err) {
    console.error("Failed to get token:", err.response?.data || err.message);
  }
}

getToken();
