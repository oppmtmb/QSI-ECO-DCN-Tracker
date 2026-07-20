import React, { useState } from 'react';
import { ArrowRight, FileText, ArrowLeftRight, Check, AlertCircle } from 'lucide-react';
import { Email, ECOMatch } from '../types';

interface RelationshipGraphProps {
  emails: Email[];
  matches: ECOMatch[];
}

export const RelationshipGraph: React.FC<RelationshipGraphProps> = ({ emails, matches }) => {
  const [hoveredEco, setHoveredEco] = useState<string | null>(null);

  const customerEmails = emails.filter(e => e.classificationGroup === 'OPEN_ANNOUNCEMENT' || (!e.classificationGroup && e.type === 'CUSTOMER'));
  const internalEmails = emails.filter(e => e.classificationGroup === 'REPLY_ANNOUNCEMENT' || (!e.classificationGroup && e.type === 'INTERNAL'));

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm mb-6" id="relationship-graph">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <ArrowLeftRight size={16} className="text-indigo-600" />
            Interactive ECO ➔ DCN Dependency Mapping
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Hover over any ECO block below to trace its source customer email and its matching QSI internal resolution.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-medium">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-indigo-500 rounded-sm"></span> Source Ann.</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-sm"></span> Linked Reply</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-rose-500 rounded-sm"></span> Unlinked (Open)</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative mt-6">
        {/* Senders & Customer Emails */}
        <div className="space-y-3">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 border-b pb-1">
            Source Announcements
          </div>
          {customerEmails.length === 0 ? (
            <div className="text-xs text-gray-400 py-4 text-center italic bg-gray-50 rounded-lg">No source announcements</div>
          ) : (
            customerEmails.map(email => {
              const containsHoveredEco = hoveredEco ? email.extractedEcos.includes(hoveredEco) : false;
              const typeLabel = email.classificationType || 'CUSTOMER';
              return (
                <div
                  key={email.id}
                  className={`p-3 rounded-lg border transition-all duration-200 text-xs ${
                    containsHoveredEco
                      ? 'border-indigo-500 bg-indigo-50/50 shadow-sm scale-[1.02]'
                      : hoveredEco
                      ? 'border-gray-100 bg-gray-50/30 opacity-40'
                      : 'border-gray-100 bg-gray-50/80 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-semibold text-indigo-700 flex items-center justify-between">
                    <span>{email.id} ({typeLabel})</span>
                    <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-mono">
                      {email.extractedEcos.join(', ') || 'No ECO'}
                    </span>
                  </div>
                  <div className="font-medium text-gray-700 mt-1 truncate">{email.subject}</div>
                </div>
              );
            })
          )}
        </div>

        {/* ECO to DCN Mapping Nodes */}
        <div className="space-y-3">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 border-b pb-1">
            ECO ➔ DCN Relationship Nodes
          </div>
          {matches.length === 0 ? (
            <div className="text-xs text-gray-400 py-4 text-center italic bg-gray-50 rounded-lg">No active tracking mappings</div>
          ) : (
            matches.map(match => {
              const isHovered = hoveredEco === match.ecoId;
              const hasDcns = match.dcns.length > 0;

              return (
                <div
                  key={match.ecoId}
                  onMouseEnter={() => setHoveredEco(match.ecoId)}
                  onMouseLeave={() => setHoveredEco(null)}
                  className={`p-3 rounded-xl border transition-all duration-300 cursor-pointer flex flex-col justify-between ${
                    isHovered
                      ? match.status === 'CLOSE'
                        ? 'border-emerald-500 bg-emerald-50/40 shadow-md ring-2 ring-emerald-100 scale-105'
                        : 'border-rose-500 bg-rose-50/30 shadow-md ring-2 ring-rose-100 scale-105'
                      : hoveredEco
                      ? 'border-gray-100 opacity-30 scale-95'
                      : match.status === 'CLOSE'
                      ? 'border-gray-100 bg-white hover:border-emerald-300 hover:bg-emerald-50/10'
                      : 'border-gray-100 bg-white hover:border-rose-300 hover:bg-rose-50/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-gray-800 text-xs flex items-center gap-1.5">
                      <FileText size={14} className="text-indigo-500" />
                      {match.ecoId}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      match.status === 'CLOSE' 
                        ? match.flag === 'LOW'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      {match.status === 'CLOSE' 
                        ? match.flag === 'LOW' 
                          ? '⚠️ LOW CONF' 
                          : 'RESOLVED' 
                        : 'OPEN'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 my-2.5 justify-center">
                    <div className="h-[1px] bg-gray-300 flex-1"></div>
                    <ArrowRight size={14} className={match.status === 'CLOSE' ? 'text-emerald-500' : 'text-rose-400'} />
                    <div className="h-[1px] bg-gray-300 flex-1"></div>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-500">Internal Link:</span>
                    <span className={`font-mono font-bold ${hasDcns ? 'text-emerald-600' : 'text-gray-400'}`}>
                      {hasDcns ? match.dcns.join(', ') : '—'}
                    </span>
                  </div>

                  {match.status === 'CLOSE' && (
                    <div className="mt-2 text-[10px] text-gray-500 border-t pt-1.5 flex items-center justify-between">
                      <span>Conf: <strong className="font-mono">{(match.confidence * 100).toFixed(0)}%</strong></span>
                      <span className="bg-gray-100 text-gray-700 px-1.5 py-0.2 rounded font-mono text-[9px]">{match.matchType} Match</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Internal Document Actions */}
        <div className="space-y-3">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 border-b pb-1">
            Linked Updates (QSI Internal)
          </div>
          {internalEmails.length === 0 ? (
            <div className="text-xs text-gray-400 py-4 text-center italic bg-gray-50 rounded-lg">No internal emails</div>
          ) : (
            internalEmails.map(email => {
              // Find if this internal email has DCNs linked to the hovered ECO
              const isLinkedToHovered = hoveredEco
                ? matches.find(m => m.ecoId === hoveredEco)?.dcns.some(dcn => email.extractedDcns.includes(dcn))
                : false;

              return (
                <div
                  key={email.id}
                  className={`p-3 rounded-lg border transition-all duration-200 text-xs ${
                    isLinkedToHovered
                      ? 'border-emerald-500 bg-emerald-50/50 shadow-sm scale-[1.02]'
                      : hoveredEco
                      ? 'border-gray-100 bg-gray-50/30 opacity-40'
                      : 'border-gray-100 bg-gray-50/80 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-semibold text-emerald-700 flex items-center justify-between">
                    <span>{email.id} ({email.classificationType || 'INTERNAL'})</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono">
                      {email.extractedDcns.join(', ') || 'No DCN'}
                    </span>
                  </div>
                  <div className="font-medium text-gray-700 mt-1 truncate">{email.subject}</div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
