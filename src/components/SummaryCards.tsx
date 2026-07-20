import React from 'react';
import { FileText, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import { SummaryStats } from '../types';

interface SummaryCardsProps {
  stats: SummaryStats;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ stats }) => {
  const closePercent = stats.totalEcos > 0 
    ? Math.round((stats.closeCount / stats.totalEcos) * 100) 
    : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4" id="summary-section">
      {/* Total ECOs */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow duration-200 flex items-center space-x-4">
        <div className="p-3 rounded-lg bg-blue-50 text-blue-600">
          <FileText size={24} />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Documents Found</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalEcos}</p>
        </div>
      </div>

      {/* Closed ECOs */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow duration-200 flex items-center space-x-4">
        <div className="p-3 rounded-lg bg-emerald-50 text-emerald-600">
          <CheckCircle2 size={24} />
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Closed Documents</p>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-bold text-gray-900">{stats.closeCount}</span>
            <span className="text-xs font-medium text-emerald-600">({closePercent}% link rate)</span>
          </div>
          {/* Subtle progress bar */}
          <div className="w-full bg-gray-100 h-1.5 rounded-full mt-2 overflow-hidden">
            <div 
              className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500" 
              style={{ width: `${closePercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Open ECOs */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow duration-200 flex items-center space-x-4">
        <div className="p-3 rounded-lg bg-rose-50 text-rose-600">
          <AlertCircle size={24} />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Open (Unmatched)</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.openCount}</p>
        </div>
      </div>

      {/* Low Confidence Matches */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow duration-200 flex items-center space-x-4">
        <div className={`p-3 rounded-lg ${stats.lowConfidenceCount > 0 ? 'bg-amber-50 text-amber-600 animate-pulse' : 'bg-gray-50 text-gray-400'}`}>
          <AlertTriangle size={24} />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Low Confidence (⚠️)</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.lowConfidenceCount}</p>
        </div>
      </div>
    </div>
  );
};
