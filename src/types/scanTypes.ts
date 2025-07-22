export interface ScanData {
  parts: Part[];
  requests: Request[];
  extraPages: ExtraPage[];
}

export interface Part {
  id: string;
  type: "html" | "js" | "css" | "image" | "font" | "other";
  actions: Action[];
}

export interface Action {
  actionId: string;
  type: string;
  data: string;
}

export interface Request {
  actionId: string;
  url: string;
  requestSource: string;
  method: string;
  status: number;
}

export interface ExtraPage {
  url: string;
  parts: Part[];
  requests: Request[];
}
