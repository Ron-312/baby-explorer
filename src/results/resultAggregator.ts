import { ScanData, Part, Action, Request, ExtraPage } from "../types/scanTypes";

export class ResultAggregator {
  private scanData: ScanData;
  private actionIdSet: Set<string> = new Set();

  constructor() {
    this.scanData = { parts: [], requests: [], extraPages: [] };
  }

  public addAction(
    partId: string,
    action: Action,
    partType: Part["type"] = "html"
  ) {
    let part = this.scanData.parts.find((p) => p.id === partId);
    if (!part) {
      part = { id: partId, type: partType, actions: [] };
      this.scanData.parts.push(part);
    }
    part.actions.push(action);
    
    // Track actionId for linkage validation
    this.actionIdSet.add(action.actionId);
  }

  public addResourcePart(
    partId: string,
    partType: Part["type"],
    url: string
  ) {
    // Check if this resource part already exists
    const existingPart = this.scanData.parts.find((p) => p.id === partId);
    if (existingPart) {
      return; // Part already exists, don't create duplicate
    }

    // Create new resource part with empty actions array
    const resourcePart: Part = {
      id: partId,
      type: partType,
      actions: []
    };

    this.scanData.parts.push(resourcePart);
  }

  public addRequest(request: Request) {
    this.scanData.requests.push(request);
  }
  
  public validateLinkage(): { linkedRequests: number; unlinkedRequests: number; totalActions: number } {
    const linkedRequests = this.scanData.requests.filter(req => 
      this.actionIdSet.has(req.actionId)
    ).length;
    
    const unlinkedRequests = this.scanData.requests.length - linkedRequests;
    const totalActions = this.actionIdSet.size;
    
    return {
      linkedRequests,
      unlinkedRequests, 
      totalActions
    };
  }
  
  public getUnlinkedRequests(): Request[] {
    return this.scanData.requests.filter(req => 
      !this.actionIdSet.has(req.actionId)
    );
  }
  
  public getActionIds(): string[] {
    return Array.from(this.actionIdSet);
  }

  public getResults(): ScanData {
    return this.scanData;
  }
  
  public getLinkageStats() {
    const validation = this.validateLinkage();
    const unlinkedRequests = this.getUnlinkedRequests();
    
    return {
      ...validation,
      linkageRate: validation.linkedRequests / this.scanData.requests.length * 100,
      unlinkedRequestSample: unlinkedRequests.slice(0, 5) // First 5 unlinked for debugging
    };
  }
}
