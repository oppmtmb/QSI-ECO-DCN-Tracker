import React from 'react';
import { Mail, Lock, Edit2, Plus, RefreshCw, AlertCircle } from 'lucide-react';
import { Email } from '../types';

interface EmailListProps {
  emails: Email[];
  onEdit: (email: Email) => void;
  onDelete: (id: string) => void;
  onAddClick: () => void;
  onResetDefaults: () => void;
  onClearAll: () => void;
  selectedEmailId: string | null;
  onSelectEmail: (id: string) => void;
}

export const EmailList: React.FC<EmailListProps> = ({
  emails,
  onEdit,
  onDelete,
  onAddClick,
  onResetDefaults,
  onClearAll,
  selectedEmailId,
  onSelectEmail,
}) => {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm h-full flex flex-col" id="email-list-container">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2 font-display">
            <Mail size={16} className="text-indigo-600" />
            รายการอีเมล / Email Feed ({emails.length})
          </h3>
          <p className="text-[11px] text-gray-500 mt-0.5">จัดการและเชื่อมโยงข้อมูล ECO และ DCN</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Deletion of entered data is disabled to prevent data loss */}
          <div className="bg-gray-50 text-gray-500 border border-gray-100 px-2 py-1.5 rounded-lg flex items-center gap-1 text-[10px] font-bold" title="ไม่อนุญาตให้ลบข้อมูลที่คีย์ไปแล้ว">
            <Lock size={11} className="text-amber-500" />
            <span>ล็อกการลบ</span>
          </div>
          <button
            onClick={onAddClick}
            className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-2 rounded-lg font-bold shadow-sm hover:shadow transition-all duration-200 cursor-pointer animate-pulse"
          >
            <Plus size={15} className="font-bold" />
            เพิ่มเมลใหม่ (Add Email)
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 max-h-[500px] pr-1">
        {emails.length === 0 ? (
          <div className="text-center py-10 px-4 border border-dashed border-gray-200 rounded-xl">
            <AlertCircle className="mx-auto text-gray-300 mb-2" size={24} />
            <p className="text-xs font-semibold text-gray-600">ไม่มีอีเมลในระบบ (No Emails)</p>
            <p className="text-[11px] text-gray-400 mt-1">กดปุ่มสีม่วง &quot;เพิ่มเมลใหม่&quot; เพื่อคีย์ข้อมูลเข้าระบบ</p>
          </div>
        ) : (
          emails.map(email => {
            const isSelected = selectedEmailId === email.id;
            const isCustomer = email.classificationGroup === 'OPEN_ANNOUNCEMENT' || (!email.classificationGroup && email.type === 'CUSTOMER');
            const groupText = isCustomer ? 'แบบที่ประกาศเพื่อเปิด' : 'แบบตอบประกาศ';
            const typeText = email.classificationType || email.type;

            return (
              <div
                key={email.id}
                onClick={() => onSelectEmail(email.id)}
                className={`p-3 rounded-lg border transition-all duration-200 cursor-pointer text-left ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/20 shadow-sm'
                    : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${isCustomer ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
                    <span className="text-[10px] font-mono font-bold text-gray-400 uppercase truncate">
                      {email.id}
                    </span>
                  </div>
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => onEdit(email)}
                      className="p-1 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                      title="Edit email"
                    >
                      <Edit2 size={12} />
                    </button>
                    {/* Lock deletion of individual email to ensure secure logs */}
                    <div className="p-1 text-gray-300" title="ไม่อนุญาตให้ลบข้อมูลที่คีย์ไปแล้ว (ตามข้อกำหนดความปลอดภัย)">
                      <Lock size={12} className="text-gray-400/60" />
                    </div>
                  </div>
                </div>

                <h4 className="text-xs font-bold text-gray-800 mt-1 line-clamp-1">
                  {email.subject}
                </h4>
                <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
                  {email.body}
                </p>

                <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    isCustomer ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {groupText}
                  </span>

                  {typeText && typeText !== 'CUSTOMER' && typeText !== 'INTERNAL' && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                      ประเภท: {typeText}
                    </span>
                  )}

                  {email.extractedEcos.map(eco => (
                    <span key={eco} className="text-[9px] font-mono font-bold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">
                      {eco}
                    </span>
                  ))}

                  {email.extractedDcns.map(dcn => (
                    <span key={dcn} className="text-[9px] font-mono font-bold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-100">
                      {dcn}
                    </span>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
