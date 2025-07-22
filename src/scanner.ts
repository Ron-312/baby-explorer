import puppeteer, { Browser, Page } from "puppeteer";
import { InputMonitor } from "./monitors/inputMonitor";
import { RequestMonitor } from "./monitors/requestMonitor";
import { ResultAggregator } from "./results/resultAggregator";
import { ScanData } from "./types/scanTypes";
import { generateLinkageReport, generateHtmlLinkageReport } from "./results/linkageReport";

export class Scanner {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private scanFinished = false;
  private scanId: string;
  private aggregator: ResultAggregator;
  private inputMonitor: InputMonitor;
  private requestMonitor: RequestMonitor;

  constructor() {
    this.scanId = new Date().toISOString().replace(/[:.]/g, "-");
    this.aggregator = new ResultAggregator();
    this.inputMonitor = new InputMonitor(this.aggregator);
    this.requestMonitor = new RequestMonitor(this.aggregator);
  }

  public async start(url: string): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: ["--start-maximized"],
    });
    this.page = await this.browser.newPage();

    // Expose finishScan bridge (as before)
    await this.page.exposeFunction("notifyFinishScan", () => {
      this.finishScan();
    });

    // Setup monitors
    await this.inputMonitor.setup(this.page);
    await this.requestMonitor.setup(this.page);

    // Navigate to the starting URL
    await this.page.goto(url, { waitUntil: "networkidle2" });

    // Wait for scan to finish
    await this.waitForScanToFinish();

    // Save results
    await this.saveResults();

    // Close browser
    await this.browser.close();
  }

  public finishScan(): void {
    this.scanFinished = true;
  }

  private async waitForScanToFinish(): Promise<void> {
    while (!this.scanFinished) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  private async saveResults(): Promise<void> {
    const scanDir = `history/${this.scanId}`;
    const fs = await import("fs");
    fs.mkdirSync(scanDir, { recursive: true });
    const resultsPath = `${scanDir}/results.json`;
    
    // Log linkage statistics before saving
    const linkageStats = this.aggregator.getLinkageStats();
    console.log(`\n=== Scan Completed ==`);
    console.log(`Scan ID: ${this.scanId}`);
    console.log(`Linkage Rate: ${linkageStats.linkageRate.toFixed(1)}%`);
    console.log(`Total Actions: ${linkageStats.totalActions}`);
    console.log(`Linked Requests: ${linkageStats.linkedRequests}`);
    console.log(`Unlinked Requests: ${linkageStats.unlinkedRequests}`);
    
    if (linkageStats.unlinkedRequestSample.length > 0) {
      console.log(`\nSample Unlinked Requests:`);
      linkageStats.unlinkedRequestSample.forEach((req, i) => {
        console.log(`  ${i + 1}. ${req.method} ${req.url} (${req.requestSource})`);
      });
    }
    
    fs.writeFileSync(
      resultsPath,
      JSON.stringify(this.aggregator.getResults(), null, 2)
    );
    
    // Generate both text and HTML linkage reports
    await generateLinkageReport(resultsPath);
    await generateHtmlLinkageReport(resultsPath);
    console.log(`\nResults saved to ${scanDir}/`);
  }
}
