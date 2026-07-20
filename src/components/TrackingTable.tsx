import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  ChevronDown, 
  ChevronUp, 
  HelpCircle, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Edit, 
  Check, 
  Undo,
  Info
} from 'lucide-react';
import { ECOMatch, Email } from '../types';

interface TrackingTableProps {
  matches: ECOMatch[];
  emails: Email[];
  onManualOverride: (ecoId: string, updatedMatch: Partial<ECOMatch>) => void;
  onResetOverride: (ecoId: string) => void;
}

export const TrackingTable: React.FC<TrackingTableProps> = ({
  matches,
  emails,
  onManualOverride,
  onResetOverride,
}) => {
  const [expandedEco, setExpandedEco] = useState<string | null>(null);
  const [editingEco, setEditingEco] = useState<string | null>(null);
  
  // Local state for editing form
  const [editDcns, setEditDcns] = useState('');
  const [editStatus, setEditStatus] = useState<'CLOSE' | 'OPEN'>('OPEN');
  const [editConfidence, setEditConfidence] = useState(0.0);
  const [editMatchType, setEditMatchType] = useState<'L1' | 'L2' | 'L3' | '—'>('—');
  const [editNotes, setEditNotes] = useState('');

  const toggleExpand = (ecoId: string) => {
    if (expandedEco === ecoId) {
      setExpandedEco(null);
    } else {
      setExpandedEco(ecoId);
    }
  };

  const startEditing = (match: ECOMatch) => {
    setEditingEco(match.ecoId);
    setEditDcns(match.dcns.join(', '));
    setEditStatus(match.status);
    setEditConfidence(match.confidence);
    setEditMatchType(match.matchType);
    setEditNotes(match.notes || '');
  };

  const saveEdit = (ecoId: string) => {
    const dcnsArray = editDcns
      .split(',')
      .map(dcn => dcn.trim().toUpperCase())
      .filter(dcn => dcn.length > 0);

    const isLow = editStatus === 'CLOSE' && editConfidence < 0.50;

    onManualOverride(ecoId, {
      dcns: dcnsArray,
      status: editStatus,
      confidence: editConfidence,
      matchType: editMatchType,
      notes: editNotes,
      flag: isLow ? 'LOW' : '',
      isManualOverride: true,
    });

    setEditingEco(null);
  };

  const getMatchTypeExplanation = (type: 'L1' | 'L2' | 'L3' | '—', ecoId: string) => {
    switch (type) {
      case 'L1':
        return `ECO number "${ecoId}" explicitly appears in the subject or main body of QSI's internal reply.`;
      case 'L2':
        return `The subject line of QSI's internal reply matches the subject line of the customer's ECO submission email by 80% or greater.`;
      case 'L3':
        return `ECO number "${ecoId}" was found ONLY in the quoted/reply history section of QSI's internal response email. This carries lower reliability.`;
      case '—':
        return `No corresponding QSI internal document change request has been matched or found.`;
      default:
        return '';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden" id="tracking-table-panel">
      <div className="p-5 border-b border-gray-50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <FileSpreadsheet size={16} className="text-indigo-600" />
            ECO-DCN Extraction & Linking Ledger
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">Dynamic linkages mapping Engineering Change Orders to Document Changes</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/75 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              <th className="py-3 px-4">Document / Change ID</th>
              <th className="py-3 px-4">DCN(s)</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Confidence</th>
              <th className="py-3 px-4">Match Type</th>
              <th className="py-3 px-4">Flag</th>
              <th className="py-3 px-4">เวลาที่บันทึก (Recorded)</th>
              <th className="py-3 px-4">Sources</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 text-xs text-gray-700">
            {matches.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-gray-400 italic">
                  No ECO matches tracked yet. Input emails in the left panel to begin.
                </td>
              </tr>
            ) : (
              matches.map(match => {
                const isExpanded = expandedEco === match.ecoId;
                const isEditing = editingEco === match.ecoId;

                return (
                  <React.Fragment key={match.ecoId}>
                    <tr className={`hover:bg-gray-50/50 transition-colors ${isExpanded ? 'bg-indigo-50/10' : ''}`}>
                      <td className="py-3.5 px-4 font-mono font-bold text-gray-900 flex items-center gap-1.5">
                        <button
                          onClick={() => toggleExpand(match.ecoId)}
                          className="p-0.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                        >
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        <span>{match.ecoId}</span>
                        {match.isManualOverride && (
                          <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200/50 px-1 py-0.2 rounded" title="Manually edited row">
                            Edited
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editDcns}
                            onChange={e => setEditDcns(e.target.value)}
                            placeholder="e.g. DCN-12345"
                            className="text-xs px-2 py-1 border border-gray-200 rounded focus:outline-none focus:border-indigo-500 font-mono w-28"
                          />
                        ) : (
                          <span className={`font-mono font-bold ${match.dcns.length > 0 ? 'text-gray-800' : 'text-gray-400'}`}>
                            {match.dcns.length > 0 ? match.dcns.join(', ') : '—'}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {isEditing ? (
                          <select
                            value={editStatus}
                            onChange={e => setEditStatus(e.target.value as 'CLOSE' | 'OPEN')}
                            className="text-xs px-2 py-1 border border-gray-200 rounded focus:outline-none focus:border-indigo-500"
                          >
                            <option value="CLOSE">CLOSE</option>
                            <option value="OPEN">OPEN</option>
                          </select>
                        ) : (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            match.status === 'CLOSE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              : 'bg-rose-50 text-rose-700 border border-rose-100'
                          }`}>
                            {match.status === 'CLOSE' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                            {match.status}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-semibold">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.05"
                            min="0"
                            max="1"
                            value={editConfidence}
                            onChange={e => setEditConfidence(parseFloat(e.target.value) || 0)}
                            className="text-xs px-2 py-1 border border-gray-200 rounded focus:outline-none focus:border-indigo-500 w-16"
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <span>{(match.confidence * 100).toFixed(0)}%</span>
                            {match.status === 'CLOSE' && (
                              <div className="w-12 bg-gray-100 h-1 rounded-full overflow-hidden">
                                <div 
                                  className={`h-1 rounded-full ${
                                    match.confidence >= 0.8 ? 'bg-emerald-500' : match.confidence >= 0.5 ? 'bg-amber-500' : 'bg-rose-400'
                                  }`}
                                  style={{ width: `${match.confidence * 100}%` }}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-medium">
                        {isEditing ? (
                          <select
                            value={editMatchType}
                            onChange={e => setEditMatchType(e.target.value as any)}
                            className="text-xs px-2 py-1 border border-gray-200 rounded focus:outline-none focus:border-indigo-500"
                          >
                            <option value="L1">L1</option>
                            <option value="L2">L2</option>
                            <option value="L3">L3</option>
                            <option value="—">—</option>
                          </select>
                        ) : (
                          match.matchType
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {match.flag ? (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-800 font-bold px-2 py-0.5 rounded border border-amber-200 animate-pulse">
                            <AlertTriangle size={12} />
                            {match.flag}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-gray-500 font-mono text-[10px] whitespace-nowrap" title={match.timestamp}>
                        {match.timestamp || '—'}
                      </td>

                      <td className="py-3.5 px-4 text-gray-500 font-mono text-[10px] truncate max-w-[120px]" title={match.source}>
                        {match.source}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end space-x-1">
                            <button
                              onClick={() => saveEdit(match.ecoId)}
                              className="p-1 rounded text-emerald-600 hover:bg-emerald-50 transition-colors"
                              title="Save override"
                            >
                              <Check size={14} />
                            </button>
                            {match.isManualOverride && (
                              <button
                                onClick={() => {
                                  onResetOverride(match.ecoId);
                                  setEditingEco(null);
                                }}
                                className="p-1 rounded text-rose-500 hover:bg-rose-50 transition-colors"
                                title="Reset to auto-calculated"
                              >
                                <Undo size={14} />
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-end space-x-1">
                            <button
                              onClick={() => startEditing(match)}
                              className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                              title="Override match specs"
                            >
                              <Edit size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* Expandable details */}
                    {isExpanded && (
                      <tr className="bg-indigo-50/5">
                        <td colSpan={9} className="py-3 px-6 text-xs text-gray-600 border-l-2 border-indigo-500">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="font-bold text-gray-700 flex items-center gap-1 mb-1">
                                <Info size={12} className="text-indigo-500" />
                                Matching Rule Explanation
                              </p>
                              <p className="text-[11px] text-gray-500 leading-relaxed">
                                {getMatchTypeExplanation(match.matchType, match.ecoId)}
                              </p>
                              {match.notes && (
                                <div className="mt-2 p-2 bg-amber-50/50 border border-amber-100 rounded text-[11px]">
                                  <strong className="text-amber-800">QA Notes:</strong> {match.notes}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col justify-between">
                              <div>
                                <p className="font-bold text-gray-700 mb-1">Impact Analysis</p>
                                <p className="text-[11px] text-gray-500">
                                  Source customer emails: <strong className="font-mono text-gray-700">{match.source}</strong>
                                </p>
                                <p className="text-[11px] text-gray-500 mt-1">
                                  Current linkage status:{' '}
                                  <strong className={match.status === 'CLOSE' ? 'text-emerald-600' : 'text-rose-500'}>
                                    {match.status === 'CLOSE' ? 'Matched with DCN Document' : 'Open (Awaiting Internal DCN)'}
                                  </strong>
                                </p>
                              </div>
                              {isEditing && (
                                <div className="mt-2">
                                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                                    QA Override Notes
                                  </label>
                                  <input
                                    type="text"
                                    value={editNotes}
                                    onChange={e => setEditNotes(e.target.value)}
                                    placeholder="Add notes for manual audit..."
                                    className="text-[11px] px-2 py-1 border border-gray-200 rounded focus:outline-none focus:border-indigo-500 w-full"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
