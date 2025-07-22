import { ResultAggregator } from "../results/resultAggregator";
import { Page } from "puppeteer";
import { Request } from "../types/scanTypes";

export class RequestMonitor {
  private resourcePartCounter = new Map<string, number>();

  constructor(private aggregator: ResultAggregator) {}

  private createResourcePart(url: string, puppeteerResourceType: string): void {
    // Map Puppeteer resource types to our schema types
    const resourceTypeMap: { [key: string]: "html" | "js" | "css" | "image" | "font" | "other" } = {
      'document': 'html',
      'script': 'js',
      'stylesheet': 'css',
      'image': 'image',
      'font': 'font',
      'fetch': 'other',
      'xhr': 'other',
      'websocket': 'other',
      'manifest': 'other',
      'media': 'other',
      'texttrack': 'other',
      'eventsource': 'other',
      'other': 'other'
    };

    const resourceType = resourceTypeMap[puppeteerResourceType] || 'other';
    
    // Skip creating parts for the main HTML document as it's handled separately
    if (resourceType === 'html') {
      return;
    }

    // Generate unique part ID for this resource type
    const counter = this.resourcePartCounter.get(resourceType) || 0;
    this.resourcePartCounter.set(resourceType, counter + 1);
    const partId = `part_${resourceType}_${counter + 1}`;

    // Create the resource part (initially with empty actions)
    this.aggregator.addResourcePart(partId, resourceType, url);
  }

  public async setup(page: Page): Promise<void> {
    // Store requests by puppeteer internal ID for response matching
    const pendingRequests = new Map<string, Request>();
    
    // Store URL -> actionId mappings reported from browser context
    const urlActionMappings = new Map<string, string>();
    
    // Expose function to receive request mappings from browser context
    await page.exposeFunction(
      "reportRequestMapping",
      (url: string, actionId: string) => {
        urlActionMappings.set(url, actionId);
        // Clean up old mappings periodically
        if (urlActionMappings.size > 1000) {
          const entries = Array.from(urlActionMappings.entries());
          // Keep only the most recent 500 mappings
          urlActionMappings.clear();
          entries.slice(-500).forEach(([u, a]) => urlActionMappings.set(u, a));
        }
      }
    );
    
    // Inject WeakMap-based correlation system in browser context
    await page.evaluateOnNewDocument(() => {
      // WeakMap to store request correlations (internal to browser)
      const requestActionMap = new WeakMap();
      
      // Instrument fetch with WeakMap correlation
      const originalFetch = window.fetch;
      window.fetch = function (
        input: RequestInfo | URL,
        init?: RequestInit
      ): Promise<Response> {
        const currentActionId = window.__currentActionId;
        
        // Extract URL for reporting BEFORE making the request
        let url: string;
        if (typeof input === 'string') {
          url = input;
        } else if (input instanceof URL) {
          url = input.href;
        } else if (input instanceof Request) {
          url = input.url;
        } else {
          url = String(input); // Fallback, shouldn't happen
        }
        
        // Report the attempt IMMEDIATELY (before CORS can block)
        if (currentActionId && (window as any).reportRequestMapping) {
          (window as any).reportRequestMapping(url, currentActionId);
        }
        
        // Call original fetch - request sent EXACTLY as intended, no modifications
        const promise = originalFetch(input, init);
        
        if (currentActionId) {
          // Store correlation using promise as key (no request modification)
          requestActionMap.set(promise, currentActionId);
        }
        
        return promise; // Return completely unmodified promise
      };

      // Instrument XMLHttpRequest with WeakMap correlation
      const originalOpen = XMLHttpRequest.prototype.open;
      const originalSend = XMLHttpRequest.prototype.send;
      
      XMLHttpRequest.prototype.open = function (
        method: string,
        url: string | URL,
        async?: boolean,
        username?: string | null,
        password?: string | null
      ): void {
        // Capture current action context when opening request
        (this as any)._capturedActionId = window.__currentActionId;
        (this as any)._requestUrl = url.toString();
        return originalOpen.apply(this, arguments as any);
      };
      
      XMLHttpRequest.prototype.send = function (
        body?: Document | XMLHttpRequestBodyInit | null
      ): void {
        const actionId = (this as any)._capturedActionId;
        const url = (this as any)._requestUrl;
        
        // Report the attempt IMMEDIATELY (before CORS can block)
        if (actionId && (window as any).reportRequestMapping) {
          (window as any).reportRequestMapping(url, actionId);
        }
        
        if (actionId) {
          // Store correlation using XMLHttpRequest object as key
          requestActionMap.set(this, actionId);
        }
        
        // Send request completely unmodified
        return originalSend.apply(this, arguments as any);
      };
    });

    // Handle requests - create request records and resource parts
    page.on("request", (req: any) => {
      const url = req.url();
      let actionId: string;
      
      // Check if we have a mapping for this URL
      if (urlActionMappings.has(url)) {
        // This request was triggered by an action - use the mapped actionId
        actionId = urlActionMappings.get(url)!;
        // DON'T delete mapping yet - requestfailed might need it too
      } else {
        // This request is not linked to any action (normal page loading)
        actionId = `http_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;
      }
      
      // Create resource part based on resource type
      const resourceType = req.resourceType();
      this.createResourcePart(url, resourceType);
      
      // Create request record
      const requestRecord: Request = {
        actionId,
        url,
        requestSource: req.resourceType(),
        method: req.method(),
        status: -1, // Will be updated when response arrives
      };
      
      // Store for response matching using puppeteer's internal request ID
      // @ts-ignore: _requestId is private, but we need it for matching
      const puppeteerRequestId = req._requestId;
      pendingRequests.set(puppeteerRequestId, requestRecord);
      
      // Add to aggregator
      this.aggregator.addRequest(requestRecord);
    });

    // Handle responses - update status
    page.on("response", (res: any) => {
      const req = res.request();
      // @ts-ignore: _requestId is private, but we use it for matching
      const puppeteerRequestId = req._requestId;
      
      // Find the stored request record
      const requestRecord = pendingRequests.get(puppeteerRequestId);
      
      if (requestRecord) {
        // Update the status directly on the stored record
        requestRecord.status = res.status();
        // Clean up the pending request
        pendingRequests.delete(puppeteerRequestId);
      } else {
        // Fallback: try to find by URL in aggregator
        const scanData = this.aggregator.getResults();
        const matchingRequest = scanData.requests.find(
          (r) => r.url === req.url() && r.status === -1
        );
        if (matchingRequest) {
          matchingRequest.status = res.status();
        }
        // No warning needed - this can happen during initialization
      }
    });
    
    // Handle request failures - capture blocked/failed requests
    page.on("requestfailed", (req: any) => {
      const url = req.url();
      const failure = req.failure();
      
      // @ts-ignore: _requestId is private, but we use it for mapping
      const puppeteerRequestId = req._requestId;
      
      // First, try to find the existing request record from the "request" event
      const existingRequestRecord = pendingRequests.get(puppeteerRequestId);
      
      if (existingRequestRecord) {
        // Update existing request record to mark as failed
        existingRequestRecord.status = -999; // Special status for failed requests
        pendingRequests.delete(puppeteerRequestId); // Clean up pending map
      } else {
        // Fallback: Create new record if somehow no "request" event fired
        let actionId: string;
        if (urlActionMappings.has(url)) {
          actionId = urlActionMappings.get(url)!;
        } else {
          actionId = `failed_${Date.now()}_${Math.random()
            .toString(36)
            .substr(2, 9)}`;
        }
        
        const requestRecord: Request = {
          actionId,
          url,
          requestSource: req.resourceType(),
          method: req.method(),
          status: -999, // Special status for failed requests
        };
        
        this.aggregator.addRequest(requestRecord);
      }
    });
    
    // Clean up old pending requests and mappings periodically
    setInterval(() => {
      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
      
      // Clean up pending requests
      for (const [key, request] of pendingRequests.entries()) {
        const actionIdParts = request.actionId.split('_');
        if (actionIdParts.length > 1) {
          const timestamp = parseInt(actionIdParts[1]);
          if (timestamp && timestamp < fiveMinutesAgo) {
            pendingRequests.delete(key);
          }
        }
      }
      
      // Clean up old URL mappings more aggressively since we don't delete them immediately
      if (urlActionMappings.size > 50) {
        const entries = Array.from(urlActionMappings.entries());
        urlActionMappings.clear();
        // Keep most recent 25 mappings
        entries.slice(-25).forEach(([url, actionId]) => 
          urlActionMappings.set(url, actionId)
        );
      }
    }, 60000); // Run cleanup every minute
  }
}