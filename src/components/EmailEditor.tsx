import React, { useState, useEffect, useRef } from 'react';
import { 
  Mail, 
  Clipboard, 
  Sparkles, 
  Check, 
  AlertCircle, 
  RefreshCw, 
  Upload, 
  FileText, 
  CheckCircle2, 
  X,
  FileCode,
  Layers
} from 'lucide-react';
import { Email } from '../types';

interface EmailEditorProps {
  selectedEmail: Email | null;
  onSave: (email: { 
    id: string; 
    subject: string; 
    body: string; 
    classificationGroup?: 'OPEN_ANNOUNCEMENT' | 'REPLY_ANNOUNCEMENT'; 
    classificationType?: string; 
  }) => void;
  onBatchAdd: (emails: { subject: string; body: string }[]) => void;
  onCancel: () => void;
}

interface ParsedEmail {
  subject: string;
  body: string;
}

/**
 * Robust MIME/Base64/Quoted-Printable Decoder for Email Subjects and Headers
 */
function decodeMimeHeader(header: string): string {
  if (!header) return '';
  return header.replace(/=\?([^?]+)\?([QB])\?([^?]+)\?=/gi, (match, charset, encoding, encodedText) => {
    if (encoding.toUpperCase() === 'B') {
      try {
        const binString = atob(encodedText);
        const bytes = new Uint8Array(binString.length);
        for (let i = 0; i < binString.length; i++) {
          bytes[i] = binString.charCodeAt(i);
        }
        return new TextDecoder(charset || 'utf-8').decode(bytes);
      } catch (e) {
        return encodedText;
      }
    } else if (encoding.toUpperCase() === 'Q') {
      try {
        const qString = encodedText.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, (_, hex) => {
          return String.fromCharCode(parseInt(hex, 16));
        });
        const bytes = new Uint8Array(qString.length);
        for (let i = 0; i < qString.length; i++) {
          bytes[i] = qString.charCodeAt(i);
        }
        return new TextDecoder(charset || 'utf-8').decode(bytes);
      } catch (e) {
        return encodedText;
      }
    }
    return encodedText;
  });
}

/**
 * Universal smart parser supporting: EML, JSON, HTML, TXT, CSV and raw emails.
 */
export function parseAnyEmailFile(fileName: string, fileText: string): ParsedEmail[] {
  const text = fileText.trim();
  if (!text) return [];

  // 1. Try JSON parsing
  if (text.startsWith('[') || text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        const results: ParsedEmail[] = [];
        for (const item of parsed) {
          const sub = item.subject || item.title || item.name || item.head || fileName.replace(/\.[^/.]+$/, "");
          const bdy = item.body || item.content || item.text || item.description || '';
          if (bdy) {
            results.push({ subject: String(sub).trim(), body: String(bdy).trim() });
          }
        }
        if (results.length > 0) return results;
      } else if (typeof parsed === 'object' && parsed !== null) {
        const sub = parsed.subject || parsed.title || parsed.name || parsed.head || fileName.replace(/\.[^/.]+$/, "");
        const bdy = parsed.body || parsed.content || parsed.text || parsed.description || '';
        if (bdy) {
          return [{ subject: String(sub).trim(), body: String(bdy).trim() }];
        }
      }
    } catch (e) {
      // Not valid JSON, continue
    }
  }

  // 2. Try HTML parsing
  if (text.toLowerCase().includes('<html') || text.toLowerCase().includes('<!doctype html>')) {
    try {
      const doc = new DOMParser().parseFromString(text, 'text/html');
      const title = doc.querySelector('title')?.textContent || doc.querySelector('h1')?.textContent || fileName.replace(/\.[^/.]+$/, "");
      const bodyText = doc.body?.textContent?.trim() || text.replace(/<[^>]*>/g, '').trim();
      if (bodyText) {
        return [{ subject: title.trim(), body: bodyText }];
      }
    } catch (e) {
      // HTML parsing failed, continue
    }
  }

  // 3. Try EML / Raw Email Headers parsing
  const hasHeaders = /^(subject|from|to|date|message-id|mime-version):/i.test(text) || 
                     /\n(subject|from|to|date|message-id):/i.test(text);

  if (hasHeaders) {
    try {
      const firstDoubleNewline = text.search(/\r?\n\r?\n/);
      let headersSection = '';
      let bodySection = text;

      if (firstDoubleNewline !== -1) {
        headersSection = text.substring(0, firstDoubleNewline);
        bodySection = text.substring(firstDoubleNewline).trim();
      }

      // Parse headers
      const headersMap: Record<string, string> = {};
      const headerLines = headersSection.split(/\r?\n/);
      let currentKey = '';

      for (const line of headerLines) {
        if (line.match(/^\s+/) && currentKey) {
          headersMap[currentKey] += ' ' + line.trim();
        } else {
          const match = line.match(/^([a-zA-Z0-9-]+):\s*(.*)$/);
          if (match) {
            currentKey = match[1].toLowerCase();
            headersMap[currentKey] = match[2];
          }
        }
      }

      // Extract subject
      let subject = headersMap['subject'] ? decodeMimeHeader(headersMap['subject']) : '';
      
      // Clean body section if it contains MIME boundaries
      let cleanBody = bodySection;
      const contentType = headersMap['content-type'] || '';
      
      if (contentType.toLowerCase().includes('multipart') || bodySection.includes('--')) {
        const boundaryMatch = contentType.match(/boundary="?([^";\s]+)"?/i) || bodySection.match(/--([a-zA-Z0-9'()+_,-.\/=]+)/);
        if (boundaryMatch) {
          const boundary = boundaryMatch[1];
          const parts = bodySection.split('--' + boundary);
          
          let plainTextPart = '';
          for (const part of parts) {
            if (part.toLowerCase().includes('content-type: text/plain')) {
              const partSplit = part.search(/\r?\n\r?\n/);
              if (partSplit !== -1) {
                plainTextPart = part.substring(partSplit).trim();
                break;
              }
            }
          }
          
          if (plainTextPart) {
            cleanBody = plainTextPart;
          } else {
            cleanBody = parts
              .filter(p => p.trim() && !p.trim().startsWith('--') && !p.trim().includes('content-type: image'))
              .map(p => {
                const partSplit = p.search(/\r?\n\r?\n/);
                return partSplit !== -1 ? p.substring(partSplit).trim() : p.trim();
              })
              .join('\n\n');
          }
        }
      }

      // Strip header-like attributes in internal boundaries
      cleanBody = cleanBody
        .split('\n')
        .filter(line => !/^(content-type|content-transfer-encoding|content-id|content-disposition):/i.test(line))
        .join('\n')
        .trim();

      if (!subject) {
        subject = fileName.replace(/\.[^/.]+$/, "");
      }

      if (subject || cleanBody) {
        return [{ subject, body: cleanBody }];
      }
    } catch (e) {
      // EML parsing failed, continue to fallback
    }
  }

  // 4. Try standard batch parser (Subject: ... / Body)
  if (text.toLowerCase().includes('subject:')) {
    const emailBlocks: ParsedEmail[] = [];
    const parts = text.split(/(?=subject:)/i);
    
    for (const part of parts) {
      if (!part.trim()) continue;
      
      const lines = part.split('\n');
      const subjectLine = decodeMimeHeader(lines[0].replace(/^subject:\s*/i, '').trim());
      const bodyText = lines.slice(1).join('\n').trim();
      
      if (subjectLine && bodyText) {
        emailBlocks.push({ subject: subjectLine, body: bodyText });
      }
    }
    if (emailBlocks.length > 0) return emailBlocks;
  }

  // 5. Fallback: Treat whole file as single email
  const cleanName = fileName.replace(/\.[^/.]+$/, "");
  return [{
    subject: cleanName,
    body: text
  }];
}

export const EmailEditor: React.FC<EmailEditorProps> = ({
  selectedEmail,
  onSave,
  onBatchAdd,
  onCancel,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'single' | 'batch'>(() => {
    return selectedEmail ? 'single' : 'upload';
  });
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [batchText, setBatchText] = useState('');
  const [batchCount, setBatchCount] = useState(0);

  // Classification States
  const [classificationGroup, setClassificationGroup] = useState<'OPEN_ANNOUNCEMENT' | 'REPLY_ANNOUNCEMENT'>('OPEN_ANNOUNCEMENT');
  const [classificationType, setClassificationType] = useState('CUSTOMER');
  const [isCustomType, setIsCustomType] = useState(false);
  const [customTypeInput, setCustomTypeInput] = useState('');

  // File Upload states
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; size: number; count: number; status: 'success' | 'error' }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lock scrolling when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    if (selectedEmail) {
      setSubject(selectedEmail.subject);
      setBody(selectedEmail.body);
      
      const group = selectedEmail.classificationGroup || (selectedEmail.type === 'INTERNAL' ? 'REPLY_ANNOUNCEMENT' : 'OPEN_ANNOUNCEMENT');
      const type = selectedEmail.classificationType || (selectedEmail.type === 'INTERNAL' ? 'INTERNAL' : 'CUSTOMER');
      
      setClassificationGroup(group);
      
      if (type !== 'CUSTOMER' && type !== 'INTERNAL' && type !== 'INTERNAL_OPEN' && type !== 'CUSTOMER_CONFIRM') {
        setIsCustomType(true);
        setClassificationType('CUSTOM');
        setCustomTypeInput(type);
      } else {
        setIsCustomType(false);
        setClassificationType(type);
        setCustomTypeInput('');
      }
      setActiveTab('single');
    } else {
      setSubject('');
      setBody('');
      setClassificationGroup('OPEN_ANNOUNCEMENT');
      setClassificationType('CUSTOMER');
      setIsCustomType(false);
      setCustomTypeInput('');
    }
  }, [selectedEmail]);

  // Live calculation of emails parsed from the batch text
  useEffect(() => {
    if (!batchText.trim()) {
      setBatchCount(0);
      return;
    }
    const emails = parseAnyEmailFile('Batch Text', batchText);
    setBatchCount(emails.length);
  }, [batchText]);

  const handleSingleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) return;

    const finalType = classificationType === 'CUSTOM' ? customTypeInput.trim() : classificationType;

    onSave({
      id: selectedEmail ? selectedEmail.id : `email_user_${Date.now()}`,
      subject,
      body,
      classificationGroup,
      classificationType: finalType || (classificationGroup === 'OPEN_ANNOUNCEMENT' ? 'CUSTOMER' : 'INTERNAL'),
    });

    if (!selectedEmail) {
      setSubject('');
      setBody('');
      setClassificationGroup('OPEN_ANNOUNCEMENT');
      setClassificationType('CUSTOMER');
      setIsCustomType(false);
      setCustomTypeInput('');
    }
  };

  const handleBatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const emails = parseAnyEmailFile('Batch Text', batchText);
    if (emails.length === 0) return;

    onBatchAdd(emails);
    setBatchText('');
  };

  const loadExampleBatch = () => {
    setBatchText(`Subject: ECO-10505: Request to swap screw length from 10mm to 12mm
Hi QSI,
We have found that 10mm screws do not engage enough threads on the heat sink bracket. 
Please implement ECO-10505 to update the screw length spec to 12mm for all future batches.
Thanks!
Jane Doe, Apex Circuits

--------------------------------------------------

Subject: (QSI) RE: ECO-10505 Heat sink screw length swap
Hello Jane,
We received your screw update instructions. We have processed this change internally as DCN-88190.
The assembly line will begin using 12mm mounting hardware on tomorrow's shift.
Regards,
Document Control Team, QSI`);
  };

  // --- File Upload / Drag & Drop Logic ---
  
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      const parsedEmails = parseAnyEmailFile(file.name, text);

      if (parsedEmails.length > 0) {
        onBatchAdd(parsedEmails);
        setUploadedFiles(prev => [
          {
            name: file.name,
            size: file.size,
            count: parsedEmails.length,
            status: 'success'
          },
          ...prev
        ]);
      } else {
        setUploadedFiles(prev => [
          {
            name: file.name,
            size: file.size,
            count: 0,
            status: 'error'
          },
          ...prev
        ]);
      }
    };

    reader.onerror = () => {
      setUploadedFiles(prev => [
        {
          name: file.name,
          size: file.size,
          count: 0,
          status: 'error'
        },
        ...prev
      ]);
    };

    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      Array.from(e.dataTransfer.files).forEach(processFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      Array.from(e.target.files).forEach(processFile);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onCancel} />
      
      {/* Modal Container */}
      <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200" id="email-editor-panel">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <Mail size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 font-display">
                {selectedEmail ? 'แก้ไขอีเมลเดิม / Edit Email' : 'นำเข้าอีเมลใหม่ / Ingest Emails'}
              </h3>
              <p className="text-[11px] text-gray-500">
                {selectedEmail ? 'ปรับแต่งข้อมูลหัวข้อและเนื้อหา' : 'เพิ่มข้อมูล ECO และ DCN เข้าสู่ระบบโดยตรง'}
              </p>
            </div>
          </div>
          <button 
            onClick={onCancel}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs switcher */}
        <div className="px-6 border-b border-gray-100 bg-white">
          <div className="flex gap-4">
            {!selectedEmail && (
              <button
                onClick={() => setActiveTab('upload')}
                className={`pb-3 pt-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'upload'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                <Upload size={14} />
                อัปโหลดไฟล์ / Upload File
              </button>
            )}
            <button
              onClick={() => setActiveTab('single')}
              className={`pb-3 pt-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'single'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <FileCode size={14} />
              {selectedEmail ? 'ฟอร์มแก้ไข / Edit Form' : 'กรอกอีเมลเดี่ยว / Single Input'}
            </button>
            {!selectedEmail && (
              <button
                onClick={() => setActiveTab('batch')}
                className={`pb-3 pt-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'batch'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                <Clipboard size={14} />
                วางอีเมลจำนวนมาก / Bulk Paste
              </button>
            )}
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          
          {activeTab === 'upload' && !selectedEmail && (
            /* FILE UPLOAD DRAG & DROP VIEW */
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                accept=".txt,.eml,.json,.html,.msg,.csv"
                onChange={handleFileChange}
              />

              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={onButtonClick}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center min-h-[220px] ${
                  isDragActive
                    ? 'border-indigo-600 bg-indigo-50/50 ring-4 ring-indigo-50'
                    : 'border-gray-200 hover:border-indigo-400 hover:bg-gray-50/50'
                }`}
              >
                <div className={`p-4 rounded-full mb-3 transition-colors ${isDragActive ? 'bg-indigo-100 text-indigo-700' : 'bg-indigo-50 text-indigo-500 animate-pulse'}`}>
                  <Upload size={32} />
                </div>
                
                <p className="text-sm font-bold text-gray-800">
                  คลิกที่นี่ หรือ ลากไฟล์อีเมลมาวางเพื่ออัปโหลด
                </p>
                <p className="text-xs text-gray-400 mt-1.5 max-w-sm">
                  รองรับไฟล์ทุกประเภท อาทิ <strong>.eml, .txt, .json, .html, .msg</strong> 
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100">
                    Auto DCN & ECO Parsing
                  </span>
                  <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-100">
                    MIME Decoder Active
                  </span>
                </div>
              </div>

              {/* Uploaded History List */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    ประวัติการอัปโหลดในการเปิดกล่องนี้ (Recent Uploads)
                  </span>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 divide-y divide-gray-50">
                    {uploadedFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-2.5 rounded-lg border text-xs ${
                          file.status === 'success'
                            ? 'bg-emerald-50/20 border-emerald-100 text-emerald-800'
                            : 'bg-rose-50/20 border-rose-100 text-rose-800'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText size={14} className={file.status === 'success' ? 'text-emerald-500' : 'text-rose-500'} />
                          <span className="font-medium truncate max-w-[280px]" title={file.name}>
                            {file.name}
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono">
                            ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <div className="flex items-center gap-1 font-semibold shrink-0">
                          {file.status === 'success' ? (
                            <>
                              <CheckCircle2 size={12} className="text-emerald-500" />
                              <span>พบและนำเข้า {file.count} เมล</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle size={12} className="text-rose-500" />
                              <span>ล้มเหลว</span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'single' && (
            <form onSubmit={handleSingleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  หัวข้ออีเมล (Subject Line) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ECO-90210: Update copper plating thickness or (QSI) RE: ..."
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 font-medium"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  พิมพ์คำว่า <strong className="font-mono text-gray-600">(QSI)</strong> หน้าหัวข้อ สำหรับอีเมลภายในเพื่อดึงค่า DCN
                </p>
              </div>

              {/* Classification Type Selection (Announcement vs Reply and Custom Type option) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50/70 p-3.5 rounded-xl border border-gray-100">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    ส่วนจัดกลุ่มหลัก (Main Classification)
                  </label>
                  <select
                    value={classificationGroup}
                    onChange={e => {
                      const val = e.target.value as 'OPEN_ANNOUNCEMENT' | 'REPLY_ANNOUNCEMENT';
                      setClassificationGroup(val);
                      if (val === 'OPEN_ANNOUNCEMENT') {
                        setClassificationType('CUSTOMER');
                        setIsCustomType(false);
                      } else {
                        setClassificationType('INTERNAL');
                        setIsCustomType(false);
                      }
                    }}
                    className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-indigo-500 font-semibold cursor-pointer text-gray-700"
                  >
                    <option value="OPEN_ANNOUNCEMENT">แบบที่ประกาศเพื่อเปิด (Announcement to Open)</option>
                    <option value="REPLY_ANNOUNCEMENT">แบบตอบประกาศ (Reply to Announcement)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    ประเภทจำแนก (Classification Type)
                  </label>
                  <div className="space-y-2">
                    <select
                      value={classificationType}
                      onChange={e => {
                        const val = e.target.value;
                        setClassificationType(val);
                        if (val === 'CUSTOM') {
                          setIsCustomType(true);
                        } else {
                          setIsCustomType(false);
                        }
                      }}
                      className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-indigo-500 font-semibold cursor-pointer text-gray-700"
                    >
                      {classificationGroup === 'OPEN_ANNOUNCEMENT' ? (
                        <>
                          <option value="CUSTOMER">CUSTOMER (ประกาศเปิดจากลูกค้า)</option>
                          <option value="INTERNAL_OPEN">INTERNAL_OPEN (ประกาศเปิดภายใน)</option>
                          <option value="CUSTOM">➕ อื่นๆ / ระบุประเภทใหม่เอง...</option>
                        </>
                      ) : (
                        <>
                          <option value="INTERNAL">INTERNAL (เอกสารตอบรับภายใน)</option>
                          <option value="CUSTOMER_CONFIRM">CUSTOMER_CONFIRM (การยืนยันจากลูกค้า)</option>
                          <option value="CUSTOM">➕ อื่นๆ / ระบุประเภทใหม่เอง...</option>
                        </>
                      )}
                    </select>

                    {isCustomType && (
                      <input
                        type="text"
                        required
                        placeholder="พิมพ์ระบุประเภทใหม่เองที่นี่... (เช่น AML_NOTICE, REVISED_SPEC)"
                        value={customTypeInput}
                        onChange={e => setCustomTypeInput(e.target.value)}
                        className="w-full text-xs px-3 py-2 border border-indigo-200 rounded-lg focus:outline-none focus:border-indigo-500 font-medium bg-white text-gray-800 placeholder-gray-400"
                      />
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  เนื้อหาอีเมล (Message Body) <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={6}
                  placeholder="วางเนื้อหาของอีเมลที่มีรหัส ECO-xxxxx หรือ DCN-xxxxx..."
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  className="w-full text-xs p-3 border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-gray-50">
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-lg text-xs font-medium cursor-pointer"
                >
                  ยกเลิก (Cancel)
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Check size={14} />
                  {selectedEmail ? 'บันทึกการแก้ไข' : 'บันทึกลง Feed (Add to Feed)'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'batch' && !selectedEmail && (
            <form onSubmit={handleBatchSubmit} className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                  วางข้อมูลอีเมลดิบหลายฉบับ
                </label>
                <button
                  type="button"
                  onClick={loadExampleBatch}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw size={12} />
                  โหลดชุดข้อมูลตัวอย่าง
                </button>
              </div>

              <textarea
                rows={8}
                placeholder="วางเนื้อความอีเมลหลายฉบับโดยคั่นด้วย Subject:
Subject: [หัวข้อ ECO]
[เนื้อความ...]
-----------------------
Subject: (QSI) RE: [หัวข้อ DCN]
[เนื้อความ...]"
                value={batchText}
                onChange={e => setBatchText(e.target.value)}
                className="w-full text-xs p-3 border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 font-mono"
              />

              <div className="bg-gray-50 p-3 rounded-lg flex items-center justify-between text-xs border border-gray-100">
                <span className="text-gray-500">
                  พบอีเมลที่อ่านได้:{' '}
                  <strong className="text-indigo-600 font-mono">{batchCount}</strong> ฉบับ
                </span>
                {batchCount > 0 && (
                  <span className="text-emerald-600 font-semibold flex items-center gap-1">
                    <Sparkles size={12} /> พร้อมที่จะบันทึกเข้าระบบ
                  </span>
                )}
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-gray-50">
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-lg text-xs font-medium cursor-pointer"
                >
                  ยกเลิก (Cancel)
                </button>
                <button
                  type="submit"
                  disabled={batchCount === 0}
                  className={`px-5 py-2 rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 ${
                    batchCount > 0
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Clipboard size={14} />
                  นำเข้าข้อมูลชุดนี้ (Load Bulk)
                </button>
              </div>
            </form>
          )}

        </div>

        {/* Modal Footer (for upload view) */}
        {activeTab === 'upload' && !selectedEmail && (
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end">
            <button
              onClick={onCancel}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <CheckCircle2 size={14} />
              เสร็จสิ้น (Done)
            </button>
          </div>
        )}
        
      </div>
    </div>
  );
};
