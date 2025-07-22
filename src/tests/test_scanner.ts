import { Scanner } from "../scanner";
import * as fs from "fs";
import * as path from "path";

// Add finishScan to Window interface for TS
declare global {
  interface Window {
    finishScan?: () => void;
  }
}

async function runTest() {
  const url = "F:/Projects/baby-explorer/src/tests/test-malicious-behavior.html";
  const scanner = new Scanner();

  console.log("Starting scan on:", url);
  // Start the scanner (this launches the browser and navigates)
  const startPromise = scanner.start(url);

  // Wait for the Puppeteer page to be available
  let retries = 0;
  while (!scanner["page"] && retries < 10) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    retries++;
  }
  if (!scanner["page"]) {
    console.error("Puppeteer page was not initialized.");
    process.exit(1);
  }

  // Wait for the page to load and monitoring logic to activate
  console.log("Waiting for page to load and monitoring logic to activate...");
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Print instructions for manual finishScan
  console.log("\n--- Manual Scan Control ---");
  console.log(
    "1. In the opened browser window, open DevTools (F12 or Ctrl+Shift+I)."
  );
  console.log("2. In the Console tab, run: finishScan()\n");
  console.log(
    "The scan will complete and results will be printed here once you call finishScan().\n"
  );

  // Wait for the scan to complete and results to be saved
  await startPromise;

  // Find the latest scan directory in history
  const historyDir = path.join("history");
  const scanDirs = fs
    .readdirSync(historyDir)
    .filter((d) => fs.statSync(path.join(historyDir, d)).isDirectory());
  const latestScanDir = scanDirs.sort().reverse()[0];
  const resultsPath = path.join(historyDir, latestScanDir, "results.json");

  if (fs.existsSync(resultsPath)) {
    const results = fs.readFileSync(resultsPath, "utf-8");
    console.log("\nScan results from:", resultsPath);
    console.log(results);
  } else {
    console.error("results.json not found in", latestScanDir);
  }
  process.exit(0);
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
