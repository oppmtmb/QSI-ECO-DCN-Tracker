import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  ArrowLeftRight, 
  Download, 
  FileSpreadsheet, 
  Mail, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Sparkles,
  Layers,
  ChevronRight,
  ArrowRight,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { Email, ECOMatch, SummaryStats } from './types';
import { 
  classifyAndParseEmail, 
  generateTrackingRows, 
  calculateSummary 
} from './utils/parser';
import { DEFAULT_RAW_EMAILS, RawEmailInput } from './utils/defaultEmails';
import { SummaryCards } from './components/SummaryCards';
import { EmailList } from './components/EmailList';
import { EmailEditor } from './components/EmailEditor';
import { TrackingTable } from './components/TrackingTable';
import { RelationshipGraph } from './components/RelationshipGraph';
import { CsvExporter } from './components/CsvExporter';
import { GoogleSheetsSync } from './components/GoogleSheetsSync';
import { saveLedgerToCloud } from './utils/firebase';

export default function App() {
  // 1. Initial Email State (Start EMPTY by default - no mockup data)
  const [emails, setEmails] = useState<Email[]>([]);

  // 2. State to track manual overrides (ECO_ID -> partial match edits)
  const [manualOverrides, setManualOverrides] = useState<Record<string, Partial<ECOMatch>>>({});

  // 3. UI states
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [isAddingEmail, setIsAddingEmail] = useState(false);
  const [editingEmail, setEditingEmail] = useState<Email | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Auto-fetch existing data on mount from backend central JSON server store
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const response = await fetch('/api/ledger');
        if (response.ok) {
          const data = await response.json();
          if (data && Array.isArray(data.emails)) {
            // Re-parse existing emails to apply any updated regex/extraction patterns in real-time
            const parsedEmails = data.emails.map((email: any) => {
              const parsed = classifyAndParseEmail(email);
              return {
                ...email,
                extractedEcos: parsed.extractedEcos,
                extractedDcns: parsed.extractedDcns,
                type: parsed.type,
                classificationGroup: email.classificationGroup || parsed.classificationGroup,
                classificationType: email.classificationType || parsed.classificationType,
              };
            });
            setEmails(parsedEmails);
            if (data.overrides) {
              setManualOverrides(data.overrides);
            }
            if (parsedEmails.length > 0) {
              setSelectedEmailId(parsedEmails[0].id);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching initial ledger data:", error);
      } finally {
        setIsInitialLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  // Custom confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // 4. Compute auto matches and combine with manual overrides
  const matches = useMemo(() => {
    const autoCalculated = generateTrackingRows(emails);
    
    // Merge overrides on top of auto calculated values
    const merged = autoCalculated.map(m => {
      if (manualOverrides[m.ecoId]) {
        return {
          ...m,
          ...manualOverrides[m.ecoId],
          isManualOverride: true,
        };
      }
      return m;
    });

    // Also look for any manual overrides for ECOs that weren't parsed from emails
    // (This allows adding completely manual records to the tracker ledger)
    const trackedEcoIds = new Set(autoCalculated.map(m => m.ecoId));
    const extraMatches: ECOMatch[] = [];

    for (const [ecoId, override] of Object.entries(manualOverrides) as [string, Partial<ECOMatch>][]) {
      if (!trackedEcoIds.has(ecoId)) {
        extraMatches.push({
          ecoId,
          dcns: override.dcns || [],
          status: override.status || 'OPEN',
          confidence: override.confidence ?? 0.0,
          matchType: override.matchType || '—',
          flag: override.flag || '',
          source: override.source || 'MANUAL_ENTRY',
          notes: override.notes || 'Manually added to ledger',
          isManualOverride: true,
        });
      }
    }

    return [...merged, ...extraMatches];
  }, [emails, manualOverrides]);

  // Keep track of previous matches to check if any OPEN ECO transitioned to CLOSE
  const prevMatchesRef = useRef<ECOMatch[]>([]);

  useEffect(() => {
    if (prevMatchesRef.current.length > 0) {
      const prevOpenEcos = prevMatchesRef.current.filter(m => m.status === 'OPEN');
      const newlyClosed: ECOMatch[] = [];

      for (const prevOpen of prevOpenEcos) {
        const current = matches.find(m => m.ecoId === prevOpen.ecoId);
        if (current && current.status === 'CLOSE') {
          newlyClosed.push(current);
        }
      }

      if (newlyClosed.length > 0) {
        setConfirmDialog({
          isOpen: true,
          title: '🎉 ค้นพบการจับคู่กับ ECO ที่ยังเปิดอยู่! / Linked to Open ECO',
          message: `ตรวจจับคู่แมทช์สำเร็จ! อีเมลที่ท่านอัปโหลด/กรอกข้อมูลเพิ่ม มีเนื้อหาที่สอดคล้องและเชื่อมโยงกับ ECO ที่สถานะยังเป็น "OPEN" อยู่ก่อนหน้านี้:\n\n${newlyClosed.map(nc => `• ECO ID: "${nc.ecoId}" -> จับคู่กับ DCN: ${nc.dcns.join(', ')} (ค่าความมั่นใจ: ${Math.round(nc.confidence * 100)}%)`).join('\n')}\n\nระบบดำเนินการปรับปรุงข้อมูลเชื่อมโยง พร้อมปรับสถานะเป็น CLOSE ในตาราง Ledger ให้โดยอัตโนมัติแล้ว!`,
          confirmText: 'รับทราบ (OK)',
          onConfirm: () => {
            setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          }
        });
      }
    }
    prevMatchesRef.current = matches;
  }, [matches]);

  // 5. Compute summary stats
  const stats = useMemo(() => {
    return calculateSummary(matches);
  }, [matches]);

  // Auto-save ledger data to central server storage when emails or manual overrides change
  useEffect(() => {
    if (!isInitialLoading) {
      saveLedgerToCloud(emails, matches, manualOverrides).catch(err => {
        console.error('Failed to auto-save ledger to server storage:', err);
      });
    }
  }, [emails, manualOverrides, matches, isInitialLoading]);

  // Find currently selected email
  const selectedEmail = useMemo(() => {
    if (!selectedEmailId) return null;
    return emails.find(e => e.id === selectedEmailId) || null;
  }, [emails, selectedEmailId]);

  // --- Callbacks ---

  // Reset to clean, empty database
  const handleResetDefaults = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'รีเซ็ตเป็นค่าว่างเปล่า / Reset to Clean Slate',
      message: 'คุณต้องการรีเซ็ตระบบกลับเป็นค่าว่างเปล่าทั้งหมดใช่หรือไม่? ข้อมูลของคุณจะถูกล้างออกเพื่อให้เริ่มคีย์ข้อมูลจริงใหม่ได้ทันที',
      confirmText: 'ใช่, รีเซ็ตเป็นค่าว่างเปล่า',
      cancelText: 'ยกเลิก',
      onConfirm: () => {
        setEmails([]);
        setManualOverrides({});
        setSelectedEmailId(null);
        setIsAddingEmail(false);
        setEditingEmail(null);
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Clear all emails and overrides to start fresh
  const handleClearAll = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'ล้าง Feed ทั้งหมด / Clear All Feed',
      message: 'คุณต้องการลบข้อมูลอีเมลทั้งหมดออกจากระบบหรือไม่? การดำเนินการนี้จะทำให้อีเมลในระบบว่างเปล่าและล้างค่าตาราง Ledger ทั้งหมด',
      confirmText: 'ใช่, ลบทั้งหมด',
      cancelText: 'ยกเลิก',
      onConfirm: () => {
        setEmails([]);
        setManualOverrides({});
        setSelectedEmailId(null);
        setIsAddingEmail(false);
        setEditingEmail(null);
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Save changes to an email or add a new one
  const handleSaveEmail = (emailData: { 
    id: string; 
    subject: string; 
    body: string; 
    classificationGroup?: 'OPEN_ANNOUNCEMENT' | 'REPLY_ANNOUNCEMENT'; 
    classificationType?: string; 
  }) => {
    const parsed = classifyAndParseEmail(emailData);

    if (parsed.classificationGroup === 'OPEN_ANNOUNCEMENT' || (!parsed.classificationGroup && parsed.type === 'CUSTOMER')) {
      // Get all other customer emails (excluding the one being edited, if editing)
      const otherEmails = emails.filter(e => e.id !== parsed.id);
      const existingEcoIds = new Set(
        otherEmails
          .filter(e => e.classificationGroup === 'OPEN_ANNOUNCEMENT' || (!e.classificationGroup && e.type === 'CUSTOMER'))
          .flatMap(e => e.extractedEcos)
          .map(eco => eco.toUpperCase())
      );

      // Check if any extracted ECOs from the new/edited email are already in existingEcoIds
      const duplicates = parsed.extractedEcos.filter(eco => existingEcoIds.has(eco.toUpperCase()));
      if (duplicates.length > 0) {
        setConfirmDialog({
          isOpen: true,
          title: '⚠️ ไม่สามารถบันทึกข้อมูลได้ / Duplicate ECO Blocked',
          message: `ตรวจพบข้อผิดพลาด: ไม่อนุญาตให้มี ECO ใหม่ชื่อซ้ำในระบบ!\n\nพบรหัส ECO "${duplicates.join(', ')}" ซ้ำกับข้อมูลที่มีอยู่แล้วในระบบ Ledger กรุณาใช้รหัสอื่นหรือทำการแก้ไขอีเมลฉบับเดิมที่มีอยู่แล้วแทน`,
          confirmText: 'ตกลง (OK)',
          onConfirm: () => {
            setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          }
        });
        return; // Reject save!
      }
    }

    setEmails(prev => {
      const index = prev.findIndex(e => e.id === parsed.id);
      if (index !== -1) {
        // Update existing
        const updated = [...prev];
        updated[index] = parsed;
        return updated;
      } else {
        // Append new
        return [...prev, parsed];
      }
    });

    setSelectedEmailId(parsed.id);
    setIsAddingEmail(false);
    setEditingEmail(null);
  };

  // Bulk load multiple emails
  const handleBatchAdd = (newRawEmails: { subject: string; body: string }[]) => {
    const parsedList: Email[] = [];
    const duplicateEcosFound = new Set<string>();

    const existingEcoIds = new Set(
      emails
        .filter(e => e.type === 'CUSTOMER')
        .flatMap(e => e.extractedEcos)
        .map(eco => eco.toUpperCase())
    );

    newRawEmails.forEach((item, i) => {
      const emailId = `email_user_${Date.now()}_${i}`;
      const parsed = classifyAndParseEmail({
        id: emailId,
        subject: item.subject,
        body: item.body,
      });

      if (parsed.type === 'CUSTOMER') {
        const duplicates = parsed.extractedEcos.filter(eco => existingEcoIds.has(eco.toUpperCase()));
        if (duplicates.length > 0) {
          duplicates.forEach(d => duplicateEcosFound.add(d.toUpperCase()));
          return; // Skip this email because it has duplicate ECOs
        }
        // Add new ECOs to set to avoid duplicates within the same batch
        parsed.extractedEcos.forEach(eco => existingEcoIds.add(eco.toUpperCase()));
      }

      parsedList.push(parsed);
    });

    if (duplicateEcosFound.size > 0) {
      setConfirmDialog({
        isOpen: true,
        title: '⚠️ ตรวจพบรหัส ECO ซ้ำ / Duplicate ECO Found',
        message: `ระบบตรวจพบรหัส ECO ซ้ำกับข้อมูลในระบบ: "${Array.from(duplicateEcosFound).join(', ')}"\n\nอีเมลเหล่านี้ได้รับการข้ามการนำเข้าโดยอัตโนมัติ เพื่อป้องกันการสร้าง ECO ซ้ำ (ตามข้อกำหนดของฝ่ายจัดซื้อและควบคุมคุณภาพ)`,
        confirmText: 'ตกลง (OK)',
        onConfirm: () => {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      });
    }

    if (parsedList.length > 0) {
      setEmails(prev => [...prev, ...parsedList]);
      setSelectedEmailId(parsedList[0].id);
    }
  };

  // Remove email from the workspace
  const handleDeleteEmail = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: '🔒 ปฏิเสธการลบข้อมูล / Deletion Blocked',
      message: `ไม่สามารถดำเนินการลบข้อมูลอีเมลรหัส "${id}" ได้ เนื่องจากระบบเปิดใช้งานกฎควบคุมคุณภาพ "ไม่อนุญาตให้ลบข้อมูลที่คีย์ไปแล้ว" เพื่อรักษาประวัติการตรวจสอบย้อนกลับ (Audit Trail) ทั้งหมด`,
      confirmText: 'ตกลง (OK)',
      onConfirm: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Set manual overrides
  const handleManualOverride = (ecoId: string, updatedMatch: Partial<ECOMatch>) => {
    setManualOverrides(prev => ({
      ...prev,
      [ecoId]: {
        ...(prev[ecoId] || {}),
        ...updatedMatch,
      },
    }));
  };

  // Reset override back to regex calculation
  const handleResetOverride = (ecoId: string) => {
    setManualOverrides(prev => {
      const updated = { ...prev };
      delete updated[ecoId];
      return updated;
    });
  };

  const handleAddClick = () => {
    setIsAddingEmail(true);
    setEditingEmail(null);
  };

  const handleEditClick = (email: Email) => {
    setEditingEmail(email);
    setIsAddingEmail(false);
  };

  const handleSelectEmail = (id: string) => {
    setSelectedEmailId(id);
  };

  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-gray-50/70 flex flex-col items-center justify-center p-4 font-sans">
        <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center max-w-sm w-full text-center space-y-4">
          <Loader2 className="animate-spin text-indigo-600" size={36} />
          <div>
            <h3 className="text-sm font-bold text-gray-900">กำลังโหลดฐานข้อมูล Ledger...</h3>
            <p className="text-[11px] text-gray-400 mt-1">Connecting to Cloud Server JSON Store</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/70 py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Top Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-200/60 pb-5" id="header-section">
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 bg-gray-900 text-white rounded-xl shadow-md">
              <Layers size={24} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-gray-900 font-display">
                  QSI ECO-DCN Email Tracker
                </h1>
                <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full">
                  Production Ops v1.4
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Automated change-control linking and classification engine for manufacturing quality management.
              </p>
            </div>
          </div>
          
          <div className="mt-4 md:mt-0 flex items-center space-x-3 text-xs font-medium text-gray-500">
            <div className="bg-white px-3.5 py-1.5 rounded-lg border border-gray-200/70 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Workspace Sync Ready</span>
            </div>
          </div>
        </header>

        {/* Google Sheets Live Sync Panel */}
        <GoogleSheetsSync 
          matches={matches} 
          emails={emails}
          manualOverrides={manualOverrides}
          onRestoreState={(restoredEmails, restoredOverrides) => {
            const parsedEmails = restoredEmails.map((email: any) => {
              const parsed = classifyAndParseEmail(email);
              return {
                ...email,
                extractedEcos: parsed.extractedEcos,
                extractedDcns: parsed.extractedDcns,
                type: parsed.type,
              };
            });
            setEmails(parsedEmails);
            setManualOverrides(restoredOverrides);
            if (parsedEmails.length > 0) {
              setSelectedEmailId(parsedEmails[0].id);
            } else {
              setSelectedEmailId(null);
            }
          }}
          onSyncSuccess={async () => {
            // Keep the data intact in the app after a successful sync to Google Sheets
            console.log('Successfully synced tracking table to Google Sheets!');
          }}
        />

        {/* Dynamic Metric Summaries */}
        <SummaryCards stats={stats} />

        {/* Main Content Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT SIDE: Email Feed & Editors (4 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <EmailList
              emails={emails}
              onEdit={handleEditClick}
              onDelete={handleDeleteEmail}
              onAddClick={handleAddClick}
              onResetDefaults={handleResetDefaults}
              onClearAll={handleClearAll}
              selectedEmailId={selectedEmailId}
              onSelectEmail={handleSelectEmail}
            />

            {/* Email Editor Panel - shows as a Modal when editing or adding */}
            {(editingEmail || isAddingEmail) && (
              <EmailEditor
                selectedEmail={editingEmail}
                onSave={handleSaveEmail}
                onBatchAdd={handleBatchAdd}
                onCancel={() => {
                  setEditingEmail(null);
                  setIsAddingEmail(false);
                }}
              />
            )}
          </div>

          {/* RIGHT SIDE: Ledger Table & Interactive Graph (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Visual Trace Flow */}
            <RelationshipGraph emails={emails} matches={matches} />

            {/* Tracking Ledger Table */}
            <TrackingTable
              matches={matches}
              emails={emails}
              onManualOverride={handleManualOverride}
              onResetOverride={handleResetOverride}
            />
          </div>
        </div>

        {/* Bottom Sheet-Ready Exporter Panel */}
        <CsvExporter matches={matches} />

        {/* Footer */}
        <footer className="pt-8 border-t border-gray-100 text-center text-xs text-gray-400 flex flex-col md:flex-row items-center justify-between gap-4">
          <p>© 2026 QSI Document Control & Quality Management System. All rights reserved.</p>
          <div className="flex items-center space-x-4">
            <a href="#summary-section" className="hover:text-gray-600 transition-colors">Back to Stats</a>
            <span>•</span>
            <a href="#relationship-graph" className="hover:text-gray-600 transition-colors">Dependency Maps</a>
            <span>•</span>
            <a href="#csv-exporter-panel" className="hover:text-gray-600 transition-colors">CSV Paste Console</a>
          </div>
        </footer>

        {/* Custom Confirmation Modal */}
        {confirmDialog.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="absolute inset-0" onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))} />
            <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-md w-full p-6 overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-red-50 text-red-600 rounded-full shrink-0">
                  <AlertTriangle size={24} />
                </div>
                <div className="space-y-1.5 flex-1">
                  <h3 className="text-sm font-bold text-gray-900 font-display">
                    {confirmDialog.title}
                  </h3>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {confirmDialog.message}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-lg text-xs font-medium cursor-pointer"
                >
                  {confirmDialog.cancelText || 'ยกเลิก'}
                </button>
                <button
                  type="button"
                  onClick={confirmDialog.onConfirm}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer"
                >
                  {confirmDialog.confirmText || 'ยืนยัน'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
