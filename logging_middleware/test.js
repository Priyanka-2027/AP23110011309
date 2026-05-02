const axios = require("axios");
const { Log } = require("./index");

const BASE_URL = "http://20.207.122.201/evaluation-service";

async function getFreshToken() {
  const response = await axios.post(`${BASE_URL}/auth`, {
    email: "priyanka_jakkampudi@srmap.edu.in",
    name: "priyanka jakkampudi",
    rollNo: "ap23110011309",
    accessCode: "QkbpxH",
    clientID: "936a1601-9979-448c-9e9d-d45682b9a3b8",
    clientSecret: "PZkCSnVafJJfzpfW",
  });
  return response.data.access_token;
}

async function testLogging() {
  console.log("Testing logging middleware...");

  const token = await getFreshToken();
  console.log("Token obtained successfully.");

  const result = await Log(
    "backend",
    "info",
    "middleware",
    "Logging middleware initialized.",
    token
  );

  console.log("Log response:", result);
}

testLogging();
