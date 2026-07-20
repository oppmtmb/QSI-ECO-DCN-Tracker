import React, { useState } from 'react';
import { Clipboard, Download, Check, Sparkles, FileSpreadsheet } from 'lucide-react';
import { ECOMatch } from '../types';
import { convertToCsv } from '../utils/parser';

interface CsvExporterProps {
  matches: ECOMatch[];
}

export const CsvExporter: React.FC<CsvExporterProps> = ({ matches }) => {
  const [copied, setCopied] = useState(false);
  const csvContent = convertToCsv(matches);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(csvContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `qsi_eco_dcn_tracker_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6" id="csv-exporter-panel">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-50 pb-4 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <FileSpreadsheet size={16} className="text-emerald-600" />
            Sheet-Ready CSV Export Terminal
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">Optimized format ready to paste directly into Google Sheets &quot;Mail update&quot;</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopy}
            className={`flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-lg font-semibold border transition-all cursor-pointer ${
              copied
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200'
            }`}
          >
            {copied ? <Check size={14} /> : <Clipboard size={14} />}
            {copied ? 'Copied to Clipboard!' : 'Copy CSV Block'}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3.5 py-1.5 rounded-lg font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <Download size={14} />
            Download .csv File
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CSV Block Preview */}
        <div className="lg:col-span-2">
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            CSV Paste Block
          </label>
          <div className="relative">
            <pre className="bg-gray-900 text-gray-100 rounded-xl p-4 font-mono text-xs overflow-x-auto h-48 border border-gray-800 shadow-inner">
              {csvContent}
            </pre>
            <div className="absolute top-2 right-2 flex items-center gap-1 bg-gray-800 text-[10px] text-gray-300 px-2 py-1 rounded font-mono border border-gray-700">
              <Sparkles size={10} className="text-emerald-400 animate-pulse" />
              RFC-4180 Compliant
            </div>
          </div>
        </div>

        {/* Integration Instructions */}
        <div className="bg-emerald-50/20 rounded-xl border border-emerald-100/50 p-5 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider mb-2.5">
              Google Sheets Paste Instructions
            </h4>
            <ol className="text-xs text-emerald-800 space-y-2 list-decimal list-inside leading-relaxed">
              <li>
                Click <strong className="text-emerald-950">Copy CSV Block</strong> above.
              </li>
              <li>
                Open your target Google Sheet named <code className="bg-emerald-100 px-1 py-0.2 rounded font-mono text-emerald-950 text-[11px] font-semibold">Mail update</code>.
              </li>
              <li>
                Select cell <strong className="text-emerald-950">A1</strong> (or the next blank row).
              </li>
              <li>
                Paste (<kbd className="bg-white border border-emerald-200 shadow-sm px-1 rounded font-mono text-[10px]">Ctrl+V</kbd> / <kbd className="bg-white border border-emerald-200 shadow-sm px-1 rounded font-mono text-[10px]">Cmd+V</kbd>).
              </li>
              <li>
                Google Sheets will automatically split the CSV into columns! (If not, click the paste icon helper and select &quot;Split text to columns&quot;).
              </li>
            </ol>
          </div>
          <div className="mt-4 pt-3 border-t border-emerald-100/30 text-[10px] text-emerald-700 italic flex items-center gap-1">
            <span>💡 Tabular separator: comma (,) | Quotes: double (&quot;)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
