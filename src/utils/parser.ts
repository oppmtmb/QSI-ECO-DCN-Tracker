import { Email, ECOMatch, SummaryStats } from '../types';

// Regex patterns supporting standard ECOs, ECNs, plus new user formats:
// ECO-XXXXXX-X, MCO-XXXXXX-X, AML-XXXXXX-X, SO-XXXXXX, SOXXXXXX, ECNXXXXXXX
export const ECO_REGEX = /\b(?:ECO|MCO|AML)-[0-9]{5,10}(?:-[A-Z0-9]{1,4})?\b|\bSO-?[0-9]{5,10}(?![0-9])|\bECN-?[0-9]{5,10}(?![0-9])/gi;
export const DCN_REGEX = /\bDCN-[A-Z0-9]{4,12}\b/gi;

/**
 * Robustly checks if a string is Base64 encoded and decodes it if it contains readable text.
 */
export function tryDecodeBase64(text: string): string {
  if (!text) return '';
  const trimmed = text.trim();

  // Helper to check if a decoded string consists of mostly readable characters (Thai & ASCII)
  const isReadableText = (str: string): boolean => {
    if (str.length === 0) return false;
    let printable = 0;
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (
        (code >= 32 && code <= 126) || 
        code === 10 || 
        code === 13 || 
        code === 9 || 
        (code >= 0x0E00 && code <= 0x0E7F)
      ) {
        printable++;
      }
    }
    return (printable / str.length) > 0.85;
  };

  // Clean all whitespace
  const cleaned = trimmed.replace(/\s+/g, '');

  // 1. Check if it starts with base64 data URL scheme
  if (cleaned.startsWith('data:')) {
    const commaIndex = cleaned.indexOf(',');
    if (commaIndex !== -1 && cleaned.includes('base64')) {
      try {
        const decoded = atob(cleaned.substring(commaIndex + 1));
        if (isReadableText(decoded)) return decoded;
      } catch (e) {}
    }
  }

  // 2. Check if it's a raw base64 block
  if (/^[A-Za-z0-9+/=\s\r\n]+$/.test(trimmed)) {
    try {
      if (cleaned.length >= 4 && cleaned.length % 4 === 0) {
        const decoded = atob(cleaned);
        if (isReadableText(decoded)) {
          return decoded;
        }
      }
    } catch (e) {}
  }

  // 3. Check for embedded base64 blocks inside headers or boundaries
  if (trimmed.includes('base64') || trimmed.includes('Content-Transfer-Encoding')) {
    const matches = trimmed.match(/[A-Za-z0-9+/=\r\n]{20,}/g);
    if (matches) {
      for (const block of matches) {
        const blockCleaned = block.replace(/\s+/g, '');
        if (blockCleaned.length >= 20 && blockCleaned.length % 4 === 0) {
          try {
            const decoded = atob(blockCleaned);
            if (isReadableText(decoded)) {
              return decoded;
            }
          } catch (e) {}
        }
      }
    }
  }

  return text;
}

/**
 * Normalizes text that has been spaced out (e.g., UTF-16 interpreted as UTF-8 or double spaced characters)
 */
export function normalizeSpacedText(text: string): string {
  if (!text) return '';
  
  // 1. Try to decode from Base64 if applicable
  let cleaned = tryDecodeBase64(text);

  // 2. Remove null bytes (\u0000) which are common when reading UTF-16 files as UTF-8
  cleaned = cleaned.replace(/\u0000/g, '');

  // 3. Normalize spaced-out sequences where letters/digits are separated by single spaces.
  const lines = cleaned.split('\n');
  const normalizedLines = lines.map(line => {
    if (!line.includes(' ')) return line;

    // Split by 2 or more spaces/tabs (representing word boundaries)
    const segments = line.split(/[\t ]{2,}/);
    
    const normalizedSegments = segments.map(seg => {
      const trimmed = seg.trim();
      if (!trimmed) return seg;

      // Spaced-out pattern: sequence of single characters separated by exactly one space
      const isSpacedOut = /^([A-Za-z0-9-_:][\t ]){2,}[A-Za-z0-9-_:]?$/i.test(trimmed) || 
                          (trimmed.split(' ').length - 1) / trimmed.length > 0.4;
      
      if (isSpacedOut) {
        // Compress single spaces inside this segment
        return trimmed.replace(/[\t ]+/g, '');
      }
      return seg;
    });

    // Rejoin the segments with a single space
    let joined = normalizedSegments.join(' ');
    
    // 4. Fallback direct compressions to ensure codes are always recovered
    joined = joined.replace(/E\s*C\s*N\s*-?\s*(?:[0-9]\s*){5,10}/gi, (m) => m.replace(/\s+/g, ''));
    joined = joined.replace(/(?:E\s*C\s*O|M\s*C\s*O|A\s*M\s*L)\s*-\s*(?:[0-9]\s*){5,10}(?:\s*-\s*(?:[A-Z0-9]\s*){1,4})?/gi, (m) => m.replace(/\s+/g, ''));
    joined = joined.replace(/N\s*-\s*(?:[A-Z0-9]\s*){2}\s*-\s*(?:[A-Z0-9]\s*){4,6}/gi, (m) => m.replace(/\s+/g, ''));
    joined = joined.replace(/P\s*R\s*N\s*-?\s*(?:[0-9]\s*){5,8}/gi, (m) => m.replace(/\s+/g, ''));
    joined = joined.replace(/S\s*O\s*-?\s*(?:[0-9]\s*){5,10}/gi, (m) => m.replace(/\s+/g, ''));
    joined = joined.replace(/D\s*C\s*N\s*-\s*(?:[A-Z0-9]\s*){4,12}/gi, (m) => m.replace(/\s+/g, ''));
    
    return joined;
  });

  return normalizedLines.join('\n');
}

/**
 * Extracts unique, uppercase DCN codes, including Agile PLM N-xx-xxxx codes, PRNs, and ECNs
 */
export function extractDcnCodes(text: string): string[] {
  // Extract standard DCN-xxxxx
  const standardDcns = text.match(/\bDCN-[A-Z0-9]+(?:-[A-Z0-9]+)*\b/gi) || [];
  
  // Extract Agile PLM N-xx-xxxx (where XX and XXXX can be alphanumeric)
  const agileDcns = text.match(/\bN-[A-Z0-9]{2,3}-[A-Z0-9]{4,6}\b/gi) || [];
  
  // Extract other general digits/numbers N-xxx...
  const agileDigits = text.match(/\bN-\d+(?:-\d+)*\b/gi) || [];

  // Extract ECNXXXXXXX and ECN-XXXXXXX
  const ecnCodes = text.match(/\bECN[A-Z0-9]{5,10}\b/gi) || text.match(/\bECN-[A-Z0-9]+\b/gi) || [];

  // Extract PRN-xxxxx codes
  const prnCodes = text.match(/\bPRN-?[0-9]{5,8}(?![0-9])/gi) || [];

  const all = [...standardDcns, ...agileDcns, ...agileDigits, ...ecnCodes, ...prnCodes];
  return Array.from(new Set(all.map(m => m.toUpperCase())));
}

/**
 * Clean subject line for reliable matching
 */
export function cleanSubject(subject: string): string {
  return subject
    .replace(/^(re|fw|fwd|reply|forward)\b[:\s-]*/gi, '')
    .replace(/^\(qsi\)\s*/gi, '')
    .trim();
}

/**
 * Fuzzy matching similarity score (Sørensen-Dice coefficient)
 * Returns a value between 0 and 1
 */
export function getSimilarity(str1: string, str2: string): number {
  const s1 = cleanSubject(str1).toLowerCase().replace(/[^a-z0-9]/g, '');
  const s2 = cleanSubject(str2).toLowerCase().replace(/[^a-z0-9]/g, '');

  if (s1 === s2) return 1.0;
  if (s1.length < 2 || s2.length < 2) return 0.0;

  const getBigrams = (str: string) => {
    const bigrams = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
  };

  const b1 = getBigrams(s1);
  const b2 = getBigrams(s2);

  let intersection = 0;
  for (const val of b1) {
    if (b2.has(val)) {
      intersection++;
    }
  }

  return (2 * intersection) / (b1.size + b2.size);
}

/**
 * Splits email body into main content and quoted reply content
 */
export function splitQuotedSection(body: string): { main: string; quoted: string } {
  const quoteMarkers = [
    /-----Original Message-----/i,
    /\bFrom: /i,
    /\bOn\s+.*\s+wrote:/i,
    /\bOn\s+.*</i,
    /--- Forwarded message ---/i,
  ];

  const lines = body.split('\n');
  let splitIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (quoteMarkers.some(regex => regex.test(line)) || line.trim().startsWith('>')) {
      splitIndex = i;
      break;
    }
  }

  if (splitIndex === -1) {
    return { main: body, quoted: '' };
  } else {
    return {
      main: lines.slice(0, splitIndex).join('\n'),
      quoted: lines.slice(splitIndex).join('\n'),
    };
  }
}

/**
 * Extracts unique, uppercase codes matching a regex
 */
export function extractCodes(text: string, regex: RegExp): string[] {
  const matches = text.match(regex) || [];
  return Array.from(new Set(matches.map(m => m.toUpperCase())));
}

/**
 * Classify a raw email input
 */
export function classifyAndParseEmail(emailText: { 
  id: string; 
  subject: string; 
  body: string;
  classificationGroup?: 'OPEN_ANNOUNCEMENT' | 'REPLY_ANNOUNCEMENT';
  classificationType?: string;
  timestamp?: string;
}): Email {
  // Normalize spaced text and null bytes first to guarantee robust parsing and display
  const normalizedSubject = normalizeSpacedText(emailText.subject);
  const normalizedBody = normalizeSpacedText(emailText.body);

  const subjectTrim = normalizedSubject.trim();
  const isInternal = /^\s*\(qsi\)/i.test(subjectTrim);

  const fullText = `${normalizedSubject}\n${normalizedBody}`;
  const extractedEcos = extractCodes(fullText, ECO_REGEX);
  const extractedDcns = extractDcnCodes(fullText);

  return {
    id: emailText.id,
    subject: normalizedSubject,
    body: normalizedBody,
    type: isInternal ? 'INTERNAL' : 'CUSTOMER',
    classificationGroup: emailText.classificationGroup || (isInternal ? 'REPLY_ANNOUNCEMENT' : 'OPEN_ANNOUNCEMENT'),
    classificationType: emailText.classificationType || (isInternal ? 'INTERNAL' : 'CUSTOMER'),
    extractedEcos,
    extractedDcns,
    timestamp: emailText.timestamp || new Date().toLocaleString("th-TH"),
  };
}

/**
 * Process a set of emails and generate the ECO-DCN tracking rows
 */
export function generateTrackingRows(emails: Email[]): ECOMatch[] {
  const customerEmails = emails.filter(e => e.classificationGroup === 'OPEN_ANNOUNCEMENT' || (!e.classificationGroup && e.type === 'CUSTOMER'));
  const internalEmails = emails.filter(e => e.classificationGroup === 'REPLY_ANNOUNCEMENT' || (!e.classificationGroup && e.type === 'INTERNAL'));

  // Map to collect ECO records
  const ecoMap = new Map<string, { sources: Set<string>; matchedInternalIds: Set<string> }>();

  // 1. Gather all ECOs from customer emails
  for (const custEmail of customerEmails) {
    for (const eco of custEmail.extractedEcos) {
      if (!ecoMap.has(eco)) {
        ecoMap.set(eco, { sources: new Set(), matchedInternalIds: new Set() });
      }
      ecoMap.get(eco)!.sources.add(custEmail.id);
    }
  }

  const results: ECOMatch[] = [];

  // 2. Perform linking and matching
  for (const [ecoId, ecoInfo] of ecoMap.entries()) {
    const matchedDcns = new Set<string>();
    let bestConfidence = 0.0;
    let bestMatchType: 'L1' | 'L2' | 'L3' | '—' = '—';
    const sourceIds = Array.from(ecoInfo.sources);

    for (const internalEmail of internalEmails) {
      const { main: mainBody, quoted: quotedBody } = splitQuotedSection(internalEmail.body);
      const subjectClean = internalEmail.subject;

      let isL1 = false;
      let isL2 = false;
      let isL3 = false;

      // Rule L1: ECO number explicitly in internal subject or main body
      const searchRegex = new RegExp(`\\b${ecoId.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
      if (searchRegex.test(subjectClean) || searchRegex.test(mainBody)) {
        isL1 = true;
      }

      // Rule L2: Subject fuzzy matches customer subject >= 80%
      // Check against any customer email that sourced this ECO
      for (const srcId of sourceIds) {
        const srcEmail = customerEmails.find(e => e.id === srcId);
        if (srcEmail) {
          const sim = getSimilarity(internalEmail.subject, srcEmail.subject);
          if (sim >= 0.8) {
            isL2 = true;
          }
        }
      }

      // Rule L3: ECO found only in quoted/reply section
      if (!isL1 && searchRegex.test(quotedBody)) {
        isL3 = true;
      }

      // Assign highest match for this specific internal email
      let currentConfidence = 0.0;
      let currentMatchType: 'L1' | 'L2' | 'L3' | '—' = '—';

      if (isL1) {
        currentConfidence = 0.95;
        currentMatchType = 'L1';
      } else if (isL2) {
        currentConfidence = 0.65;
        currentMatchType = 'L2';
      } else if (isL3) {
        currentConfidence = 0.40;
        currentMatchType = 'L3';
      }

      if (currentConfidence > 0) {
        ecoInfo.matchedInternalIds.add(internalEmail.id);
        // Track the DCNs from this matched internal email
        for (const dcn of internalEmail.extractedDcns) {
          matchedDcns.add(dcn);
        }

        if (currentConfidence > bestConfidence) {
          bestConfidence = currentConfidence;
          bestMatchType = currentMatchType;
        }
      }
    }

    const dcnList = Array.from(matchedDcns);
    const status = dcnList.length > 0 ? 'CLOSE' : 'OPEN';
    const confidence = status === 'CLOSE' ? bestConfidence : 0.0;
    const matchType = status === 'CLOSE' ? bestMatchType : '—';
    const flag = status === 'CLOSE' && confidence < 0.50 ? 'LOW' : '';

    // Find latest timestamp among all associated emails
    const associatedEmails = emails.filter(e => sourceIds.includes(e.id) || ecoInfo.matchedInternalIds.has(e.id));
    const timestamps = associatedEmails
      .map(e => e.timestamp)
      .filter(Boolean) as string[];
    const recordTimestamp = timestamps.length > 0 
      ? timestamps[timestamps.length - 1] 
      : new Date().toLocaleString("th-TH");

    results.push({
      ecoId,
      dcns: dcnList,
      status,
      confidence,
      matchType,
      flag,
      source: sourceIds.join(', '),
      timestamp: recordTimestamp,
    });
  }

  // 3. Keep tracking rows for emails that have a reply but no ECO matching
  const matchedCustomerIds = new Set<string>();
  const matchedInternalIds = new Set<string>();

  for (const match of results) {
    if (match.source) {
      match.source.split(',').forEach(id => {
        const trimmed = id.trim();
        if (trimmed) {
          matchedCustomerIds.add(trimmed);
        }
      });
    }
  }

  for (const [_, ecoInfo] of ecoMap.entries()) {
    for (const internalId of ecoInfo.matchedInternalIds) {
      matchedInternalIds.add(internalId);
    }
  }

  // Find pairs of (custEmail, internalEmail) that are replies of each other but not matched to any ECO
  for (const custEmail of customerEmails) {
    const hasEcoMatch = matchedCustomerIds.has(custEmail.id);
    
    // Find all internal emails that are replies to this customer email
    const replies = internalEmails.filter(internalEmail => {
      if (matchedInternalIds.has(internalEmail.id)) return false;
      
      // 1. Check subject fuzzy similarity
      const sim = getSimilarity(internalEmail.subject, custEmail.subject);
      if (sim >= 0.8) return true;

      // 2. Check if they share any common DCN code (e.g. PRN-xxxxx or N-xx-xxxxx)
      const hasCommonDcn = custEmail.extractedDcns.some(dcn => 
        internalEmail.extractedDcns.includes(dcn)
      );
      if (hasCommonDcn) return true;

      return false;
    });

    if (replies.length > 0) {
      if (!hasEcoMatch) {
        // Collect all DCNs from the customer email and all its reply internal emails
        const allDcns = new Set<string>();
        for (const dcn of custEmail.extractedDcns) {
          allDcns.add(dcn);
        }
        for (const reply of replies) {
          for (const dcn of reply.extractedDcns) {
            allDcns.add(dcn);
          }
        }

        const dcnList = Array.from(allDcns);
        const firstDcn = dcnList[0];
        
        // Build a unique and clean display ID for this row
        const displayId = firstDcn ? `NO-ECO (${firstDcn})` : `NO-ECO (REPLY: ${custEmail.id})`;

        const status = dcnList.length > 0 ? 'CLOSE' : 'OPEN';
        const confidence = status === 'CLOSE' ? 0.65 : 0.0;
        const matchType = status === 'CLOSE' ? 'L2' : '—';
        const flag = status === 'CLOSE' && confidence < 0.50 ? 'LOW' : '';

        const sourceIds = [custEmail.id, ...replies.map(r => r.id)];

        // Find latest timestamp among associated emails
        const associatedEmails = [custEmail, ...replies];
        const timestamps = associatedEmails.map(e => e.timestamp).filter(Boolean) as string[];
        const recordTimestamp = timestamps.length > 0 ? timestamps[timestamps.length - 1] : new Date().toLocaleString("th-TH");

        results.push({
          ecoId: displayId,
          dcns: dcnList,
          status,
          confidence,
          matchType,
          flag,
          source: sourceIds.join(', '),
          timestamp: recordTimestamp,
        });

        matchedCustomerIds.add(custEmail.id);
        replies.forEach(r => matchedInternalIds.add(r.id));
      }
    }
  }

  return results;
}

/**
 * Calculates summary metrics
 */
export function calculateSummary(matches: ECOMatch[]): SummaryStats {
  const totalEcos = matches.length;
  const closeCount = matches.filter(m => m.status === 'CLOSE').length;
  const openCount = matches.filter(m => m.status === 'OPEN').length;
  const lowConfidenceCount = matches.filter(m => m.flag === 'LOW').length;

  return {
    totalEcos,
    closeCount,
    openCount,
    lowConfidenceCount,
  };
}

/**
 * Converts matches to CSV string
 */
export function convertToCsv(matches: ECOMatch[]): string {
  const headers = ['ECO_ID', 'DCN(s)', 'Status', 'Confidence', 'Match_Type', 'Flag', 'Source', 'Recorded_Time'];
  const rows = matches.map(m => [
    m.ecoId,
    m.dcns.length > 0 ? m.dcns.join(', ') : '—',
    m.status,
    m.confidence.toFixed(2),
    m.matchType,
    m.flag ? `⚠️ ${m.flag}` : '',
    m.source,
    m.timestamp || '—',
  ]);

  return [headers.join(','), ...rows.map(r => r.map(val => `"${val.replace(/"/g, '""')}"`).join(','))].join('\n');
}
