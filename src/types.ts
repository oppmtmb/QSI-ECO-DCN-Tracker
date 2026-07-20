export interface Email {
  id: string;
  subject: string;
  body: string;
  type: 'CUSTOMER' | 'INTERNAL';
  classificationGroup?: 'OPEN_ANNOUNCEMENT' | 'REPLY_ANNOUNCEMENT';
  classificationType?: string; // e.g. 'CUSTOMER', 'INTERNAL', or custom name
  extractedEcos: string[];
  extractedDcns: string[];
  timestamp?: string;
}

export interface ECOMatch {
  ecoId: string;
  dcns: string[];
  status: 'CLOSE' | 'OPEN';
  confidence: number;
  matchType: 'L1' | 'L2' | 'L3' | '—';
  flag: 'LOW' | '';
  source: string; // Comma separated email IDs
  notes?: string;
  isManualOverride?: boolean;
  timestamp?: string; // เวลาที่บันทึก
}

export interface SummaryStats {
  totalEcos: number;
  closeCount: number;
  openCount: number;
  lowConfidenceCount: number;
}
