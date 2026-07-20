import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  CloudLightning, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  ExternalLink, 
  Send,
  AlertTriangle,
  RefreshCw,
  CloudDownload,
  ShieldAlert,
  Info
} from 'lucide-react';
import { ECOMatch, Email } from '../types';
import { saveLedgerToCloud, loadLedgerFromCloud } from '../utils/firebase';

interface GoogleSheetsSyncProps {
  matches: ECOMatch[];
  emails: Email[];
  manualOverrides: Record<string, Partial<ECOMatch>>;
  onRestoreState: (emails: Email[], overrides: Record<string, Partial<ECOMatch>>) => void;
  onSyncSuccess?: () => void;
}

const SPREADSHEET_ID = '15Mj6A4XAj42T92ddmbgbW-lT6ulgzkc_qx2fHp0YT0c';
const SPREADSHEET_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit?gid=0#gid=0`;

export const GoogleSheetsSync: React.FC<GoogleSheetsSyncProps> = ({ 
  matches, 
  emails, 
  manualOverrides, 
  onRestoreState,
  onSyncSuccess
}) => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [syncStep, setSyncStep] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);
  
  // Real Google Sheets configuration status
  const [sheetsConfigured, setSheetsConfigured] = useState(false);
  const [serviceAccountEmail, setServiceAccountEmail] = useState<string | null>(null);

  // Track if cloud has saved state available on startup
  const [hasCloudData, setHasCloudData] = useState(false);
  const [cloudDataTimestamp, setCloudDataTimestamp] = useState<string | null>(null);
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);

  // Local backup states
  const [hasLocalBackup, setHasLocalBackup] = useState(false);
  const [localBackupTimestamp, setLocalBackupTimestamp] = useState<string | null>(null);
  const [isLoadingLocal, setIsLoadingLocal] = useState(false);
  const [hasCloudError, setHasCloudError] = useState(false);

  // Check Firestore, local backup, and Google Sheets configuration on startup
  useEffect(() => {
    const checkBackupAndCloudAndConfig = async () => {
      // 1. Check local backup first (always available and fast)
      try {
        const localDataRaw = localStorage.getItem('shared_ledger_local_backup');
        if (localDataRaw) {
          const localData = JSON.parse(localDataRaw);
          if (localData && localData.updatedAt && Array.isArray(localData.emails)) {
            setHasLocalBackup(true);
            const localDate = new Date(localData.updatedAt);
            setLocalBackupTimestamp(localDate.toLocaleString('th-TH'));
          }
        }
      } catch (e) {
        console.warn('Error reading local backup:', e);
      }

      // 2. Check cloud data
      try {
        const data = await loadLedgerFromCloud();
        if (data && data.updatedAt) {
          setHasCloudData(true);
          const date = new Date(data.updatedAt);
          setCloudDataTimestamp(date.toLocaleString('th-TH'));
          setHasCloudError(false);
        }
      } catch (err: any) {
        console.warn('Error checking cloud data on mount:', err);
        setHasCloudError(true);
      }

      // 3. Query Google Sheets config status from Backend
      try {
        const configRes = await fetch('/api/sheets/config');
        if (configRes.ok) {
          const configData = await configRes.json();
          setSheetsConfigured(configData.configured);
          setServiceAccountEmail(configData.clientEmail);
        }
      } catch (err) {
        console.warn('Error checking Google Sheets configuration on mount:', err);
      } finally {
        setIsInitializing(false);
      }
    };
    checkBackupAndCloudAndConfig();
  }, []);

  const handleSyncData = async () => {
    setSyncStatus('syncing');
    setErrorMessage(null);

    try {
      // Step 1: Save data to Server Storage (Central quality control cloud db)
      setSyncStep('กำลังส่งข้อมูลขึ้นระบบคลาวด์กลางส่วนควบคุมคุณภาพ (Server Storage)...');
      await saveLedgerToCloud(emails, matches, manualOverrides);
      await new Promise(r => setTimeout(r, 600));

      // Step 2: Push to Google Sheets API
      setSyncStep('กำลังเชื่อมต่อ Google Sheets API ด้วย Service Account...');
      const localTimeStr = new Date().toLocaleString('th-TH');
      const response = await fetch('/api/sheets/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          matches,
          spreadsheetId: SPREADSHEET_ID,
          localTime: localTimeStr,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 412) {
          throw new Error(`AUTH_REQUIRED:${errorData.message}`);
        }
        throw new Error(errorData.message || 'เกิดข้อผิดพลาดในการเรียก Google Sheets API');
      }

      setSyncStatus('success');
      setLastSyncedTime(new Date().toLocaleTimeString('th-TH'));
      
      // Update cloud/local indicators
      setHasCloudData(true);
      setCloudDataTimestamp(new Date().toLocaleString('th-TH'));
      setHasLocalBackup(true);
      setLocalBackupTimestamp(new Date().toLocaleString('th-TH'));
      setHasCloudError(false);

      if (onSyncSuccess) {
        onSyncSuccess();
      }

    } catch (err: any) {
      console.error('Sync Error:', err);
      setSyncStatus('error');
      
      let msg = err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์ระบบคลาวด์ภายใน';
      if (err.message && err.message.includes('AUTH_REQUIRED')) {
        msg = 'ยังไม่ได้เปิดใช้งานหรือยังไม่ได้กำหนดค่าคีย์รหัสผ่าน (Private Key) ของ Service Account ปลั๊กอินชีต กรุณาป้อนคีย์ในเมนูตั้งค่าและลองใหม่อีกครั้ง';
      } else if (err.message && (err.message.toLowerCase().includes('failed to fetch') || err.message.toLowerCase().includes('networkerror') || err.message.toLowerCase().includes('load failed'))) {
        msg = 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ปลายทางได้ (Failed to Fetch) ตรวจพบข้อจำกัดเกี่ยวกับสิทธิ์ความปลอดภัยหรือการบล็อกเครือข่าย กรุณากดปุ่ม "เปิดแอปในแท็บใหม่" (Open in a new tab) ที่ปุ่มแชร์ด้านขวาบนเพื่อทดสอบการเรียกใช้งานนอกกรอบ iFrame ของระเบียงจำลอง ซึ่งจะช่วยแก้ไขปัญหา Adblocker, Brave Shields หรือ VPN บล็อกการเชื่อมต่อได้อย่างสมบูรณ์แบบ';
      }
      setErrorMessage(msg);
    }
  };

  const handleLoadFromCloud = async () => {
    setIsLoadingCloud(true);
    setErrorMessage(null);
    try {
      const data = await loadLedgerFromCloud();
      if (data && Array.isArray(data.emails)) {
        onRestoreState(data.emails, data.overrides || {});
        setSyncStatus('idle');
        setHasCloudError(false);
        
        // Notify user of successful restore
        alert(`ดึงข้อมูลกลางสำเร็จ! โหลดรายการอีเมล ${data.emails.length} ฉบับ และตารางประวัติจากระบบคลาวด์เรียบร้อยแล้ว`);
      } else {
        setErrorMessage('ไม่พบข้อมูลบันทึกบนระบบคลาวด์ กรุณากรอกและบันทึกข้อมูลก่อน');
      }
    } catch (err: any) {
      console.error('Error restoring state from cloud:', err);
      setHasCloudError(true);
      
      let msg = 'ไม่สามารถดึงข้อมูลจากเซิร์ฟเวอร์ระบบคลาวด์ภายในได้ กรุณาลองใหม่อีกครั้ง';
      setErrorMessage(msg);
    } finally {
      setIsLoadingCloud(false);
    }
  };

  const handleLoadFromLocal = () => {
    setIsLoadingLocal(true);
    setErrorMessage(null);
    try {
      const localDataRaw = localStorage.getItem('shared_ledger_local_backup');
      if (localDataRaw) {
        const localData = JSON.parse(localDataRaw);
        if (localData && Array.isArray(localData.emails)) {
          onRestoreState(localData.emails, localData.overrides || {});
          setSyncStatus('idle');
          alert(`โหลดข้อมูลที่บันทึกสำรองในเบราว์เซอร์นี้สำเร็จ! (${localData.emails.length} รายการ)`);
        } else {
          setErrorMessage('ไม่พบไฟล์สำรองที่มีเนื้อหาสมบูรณ์ในเบราว์เซอร์นี้');
        }
      } else {
        setErrorMessage('ไม่พบข้อมูลบันทึกสำรองบนเบราว์เซอร์นี้');
      }
    } catch (err) {
      console.error('Error loading local backup:', err);
      setErrorMessage('เกิดข้อผิดพลาดในการเปิดไฟล์ข้อมูลสำรองภายในเครื่อง');
    } finally {
      setIsLoadingLocal(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6" id="sheets-sync-panel">
      {isInitializing ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="animate-spin text-indigo-600 mb-2" size={24} />
          <span className="text-xs text-gray-500 font-mono">กำลังตรวจสอบสถานะการเชื่อมต่อ...</span>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-50 pb-4 mb-6">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet size={16} className="text-indigo-600" />
                <span>เชื่อมต่อกับระบบคลาวด์และชีตส่วนกลาง (Central Sync Panel)</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                ส่งข้อมูล Ledger ล่าสุดไปบันทึกยังระบบคลาวด์และชีตส่วนกลาง หรือดึงผลงานล่าสุดกลับมาทำต่อได้ตลอดเวลา
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleSyncData}
                disabled={syncStatus === 'syncing' || matches.length === 0}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs px-5 py-2.5 rounded-lg font-bold shadow-md hover:shadow-lg transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                {syncStatus === 'syncing' ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={13} />
                )}
                {syncStatus === 'syncing' ? 'กำลังบันทึก...' : 'บันทึกข้อมูลส่วนกลาง (Sync Now)'}
              </button>
            </div>
          </div>

          {/* Cloud Connection Info Notice */}
          {hasCloudError && (
            <div className="bg-amber-50/50 border border-amber-100/80 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="text-amber-600 shrink-0 mt-0.5" size={16} />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-amber-900 leading-none">
                    เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์ระบบคลาวด์ / Cloud Server Connection Error
                  </h4>
                  <p className="text-[11px] text-amber-700 leading-relaxed font-sans">
                    ไม่สามารถเข้าถึงฐานข้อมูลกลางหลังบ้านผ่านเบราว์เซอร์นี้ได้ อาจเกิดจากระบบรักษาความปลอดภัยเครือข่ายหรือปลั๊กอินบล็อกโฆษณา บล็อกการส่งข้อมูลภายนอก
                  </p>
                </div>
              </div>

              {/* Fallback load button (from localStorage) */}
              {hasLocalBackup && (
                <div className="pt-1 flex items-center justify-between gap-3 bg-white/80 border border-amber-100/50 rounded-lg p-2.5 text-xs">
                  <div className="text-slate-600 text-[11px]">
                    💾 มีประวัติล่าสุดที่บันทึกสำรองในเบราว์เซอร์นี้เมื่อ: <strong className="font-semibold text-indigo-900">{localBackupTimestamp}</strong>
                  </div>
                  <button
                    onClick={handleLoadFromLocal}
                    disabled={isLoadingLocal}
                    className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50 text-[11px]"
                  >
                    {isLoadingLocal ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <CloudDownload size={12} />
                    )}
                    <span>โหลดสำรองในเครื่อง (Load Backup)</span>
                  </button>
                </div>
              )}
            </div>
          )}


          {/* Cloud Indicator Banner */}
          {hasCloudData && !hasCloudError && (
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5 text-slate-600">
                <CloudLightning size={15} className="text-amber-500 animate-pulse shrink-0" />
                <span>
                  พบบันทึกส่วนกลางล่าสุดบนระบบคลาวด์: <strong className="font-semibold text-slate-800">{cloudDataTimestamp}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleLoadFromCloud}
                  disabled={isLoadingCloud}
                  className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-800 font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isLoadingCloud ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <CloudDownload size={13} />
                  )}
                  <span>ดึงข้อมูลมาทำต่อ (Load Data)</span>
                </button>
              </div>
            </div>
          )}

          {/* Connection Status Panel */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50 border border-slate-100 rounded-xl p-4">
            <div className="flex items-center gap-2.5 text-xs text-slate-600">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${sheetsConfigured ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${sheetsConfigured ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
              </span>
              <div className="space-y-0.5">
                <p className="font-semibold text-slate-800">
                  {sheetsConfigured 
                    ? "✓ ระบบเชื่อมต่อ Google Sheets API สำเร็จด้วย Service Account" 
                    : "รอตั้งค่า Private Key ของ Google Service Account ใน Settings"}
                </p>
                <p className="text-[10px] text-gray-500 font-mono">
                  Service Email: eco-dcn-tracker@sheet-mail-501906.iam.gserviceaccount.com
                </p>
              </div>
            </div>
          </div>

          {/* Service Account Share Instruction Card when not fully configured */}
          {!sheetsConfigured && (
            <div className="bg-slate-50 border border-gray-100 rounded-xl p-4 text-xs space-y-2">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <Info size={14} className="text-slate-500" />
                <span>ขั้นตอนการซิงก์ข้อมูลตรงสู่ Google Sheet ของคุณ:</span>
              </div>
              <ol className="list-decimal pl-4 space-y-1.5 text-[11px] text-gray-600 leading-relaxed">
                <li>
                  แชร์สิทธิ์การแก้ไข (Editor) ของชีตปลายทางของคุณให้แก่บัญชีบริการ: <code className="bg-gray-100 text-indigo-700 font-mono px-1 py-0.5 rounded select-all font-semibold">eco-dcn-tracker@sheet-mail-501906.iam.gserviceaccount.com</code>
                </li>
                <li>
                  นำไฟล์คีย์ (Private Key) ของบัญชีบริการนี้มาใส่ใน Environment Variables ในหน้าเมนู Settings ของ AI Studio โดยระบุชื่อตัวแปร <code className="bg-gray-100 text-slate-800 font-mono px-1 py-0.5 rounded font-bold">GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY</code> และ <code className="bg-gray-100 text-slate-800 font-mono px-1 py-0.5 rounded font-bold">GOOGLE_SERVICE_ACCOUNT_EMAIL</code>
                </li>
              </ol>
            </div>
          )}

          {/* Syncing Progress Step Logs */}
          {syncStatus === 'syncing' && (
            <div className="bg-indigo-50/30 border border-indigo-100/50 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2.5 text-xs font-semibold text-indigo-900 font-mono">
                <Loader2 size={14} className="animate-spin text-indigo-600" />
                <span>{syncStep}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-indigo-600 h-1.5 transition-all duration-500 rounded-full"
                  style={{
                    width: syncStep.includes('เตรียม') ? '20%' :
                           syncStep.includes('Firestore') ? '50%' :
                           syncStep.includes('API') ? '85%' : '100%'
                  }}
                />
              </div>
            </div>
          )}

          {/* Sync Success Feedback Card */}
          {syncStatus === 'success' && (
            <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-100 rounded-xl p-4 animate-in slide-in-from-top-2 duration-200">
              <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={16} />
              <div className="space-y-0.5 flex-1">
                <h5 className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                  <span>บันทึกข้อมูลสำเร็จ! / Synced Successfully</span>
                  <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded">SERVICE ACCOUNT MODE</span>
                </h5>
                <p className="text-[11px] text-emerald-700 leading-relaxed">
                  ข้อมูลตาราง Ledger ล่าสุด (<strong className="text-emerald-950 font-bold">{matches.length} รายการ</strong>) อัปเดตไปยังระบบคลาวด์ และเขียนทับไปยัง Google Sheet ปลายทางเรียบร้อยแล้ว!
                </p>
                <div className="text-[10px] text-emerald-600 font-mono pt-1">
                  เวลาซิงค์เสร็จสิ้นล่าสุด: {lastSyncedTime} (เวลาท้องถิ่น)
                </div>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {syncStatus === 'error' && errorMessage && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl p-4 animate-in slide-in-from-top-2 duration-200">
              <XCircle className="text-red-600 shrink-0 mt-0.5" size={16} />
              <div className="space-y-0.5 flex-1">
                <h5 className="text-xs font-bold text-red-900">
                  เกิดข้อผิดพลาดในการเชื่อมต่อ / Connection Failed
                </h5>
                <p className="text-[11px] text-red-700 leading-relaxed font-sans">
                  {errorMessage}
                </p>
              </div>
            </div>
          )}

          {/* Empty Warnings */}
          {matches.length === 0 && syncStatus !== 'syncing' && (
            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs">
              <AlertTriangle size={14} className="shrink-0" />
              <span>เนื่องจาก Feed เริ่มต้นเป็นค่าว่าง กรุณาคีย์ข้อมูลเพิ่มหรือกดดึงข้อมูลล่าสุดจากปุ่ม &quot;ดึงข้อมูลมาทำต่อ (Load Data)&quot; ก่อนซิงก์ส่วนกลาง</span>
            </div>
          )}

        </div>
      )}
    </div>
  );
};
