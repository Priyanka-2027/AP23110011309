const { Log } = require("./index");

// Replace with your actual token to test
const TOKEN = process.env.AUTH_TOKEN || "";

async function testLogging() {
  console.log("Testing logging middleware...");

  const result = await Log(
    "backend",
    "info",
    "middleware",
    "Logging middleware initialized.",
    TOKEN
  );

  console.log("Log response:", result);
}

testLogging();
