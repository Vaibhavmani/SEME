import React from 'react';
import { SheetSummary, ExtractedMediaAnchor } from '../types';
import { Image, CheckSquare, Square, Table, AlertTriangle, HelpCircle, Layers } from 'lucide-react';

interface Step3Props {
  sheet: SheetSummary;
  anchors: ExtractedMediaAnchor[];
  selectedMediaColumns: string[];
  onToggleColumn: (colName: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export const Step3_ColumnMap: React.FC<Step3Props> = ({
  sheet,
  anchors,
  selectedMediaColumns,
  onToggleColumn,
  onNext,
  onBack,
}) => {
  // Count media anchors per column header and track workbooks/sheets
  const mediaCountByHeader = new Map<string, number>();
  const workbooksByHeader = new Map<string, Set<string>>();

  for (const a of anchors) {
    const current = mediaCountByHeader.get(a.colName) || 0;
    mediaCountByHeader.set(a.colName, current + 1);

    if (a.workbookName || a.sheetName) {
      const wbSet = workbooksByHeader.get(a.colName) || new Set<string>();
      const label = a.workbookName ? `${a.workbookName}` : (a.sheetName || '');
      wbSet.add(label);
      workbooksByHeader.set(a.colName, wbSet);
    }
  }

  const totalPhotosDetected = anchors.length;
  const uniqueWorkbooks = new Set(anchors.map(a => a.workbookName).filter(Boolean));

  // Collect representative sample rows from each sheet/workbook
  const representativeSampleRows: Record<string, any>[] = [];
  const rowsBySheetMap = new Map<string, Record<string, any>[]>();
  sheet.sampleRows.forEach(r => {
    const key = r._sheetName || r._workbookName || 'Sheet';
    const list = rowsBySheetMap.get(key) || [];
    list.push(r);
    rowsBySheetMap.set(key, list);
  });
  rowsBySheetMap.forEach((rows) => {
    representativeSampleRows.push(...rows.slice(0, 3));
  });
  const displaySampleRows = representativeSampleRows.length > 0 ? representativeSampleRows : sheet.sampleRows.slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <h2 className="text-2xl font-bold text-slate-100">Step 3: Select Media Columns</h2>
        <p className="text-slate-400 text-sm">
          Choose which column(s) in your spreadsheet contain the photos you want to extract.
        </p>
      </div>

      {/* Multi-Workbook Confirmation Banner */}
      {uniqueWorkbooks.size > 1 && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between text-xs text-emerald-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-emerald-100 text-sm">
                Multi-Workbook Batch Mode Active ({uniqueWorkbooks.size} Workbooks Loaded)
              </p>
              <p className="text-emerald-300/80 mt-0.5">
                All media columns across all {uniqueWorkbooks.size} uploaded workbooks have been detected ({totalPhotosDetected} total photos collected).
              </p>
            </div>
          </div>
          <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold rounded-full text-xs">
            {totalPhotosDetected} Photos Collected
          </span>
        </div>
      )}

      {/* Easy Language Guide Box */}
      <div className="bg-brand-500/10 border border-brand-500/30 rounded-2xl p-4 text-xs space-y-2 text-brand-200">
        <div className="flex items-center space-x-2 font-bold text-brand-300">
          <HelpCircle className="w-4 h-4 text-brand-400" />
          <span>💡 Quick Guide — How to complete Step 3</span>
        </div>
        <p className="text-slate-300">
          <strong>What to do:</strong> Click the check boxes for the column names that contain your pictures. Green numbers show how many photos were found in each column across all selected files.
        </p>
        <p className="text-slate-300">
          <strong>Example:</strong> If your spreadsheets have photos in <code className="bg-slate-800 text-brand-300 px-1.5 py-0.5 rounded">Detected Face</code>, <code className="bg-slate-800 text-brand-300 px-1.5 py-0.5 rounded">POI Image</code>, <code className="bg-slate-800 text-brand-300 px-1.5 py-0.5 rounded">Face Evidence</code>, and <code className="bg-slate-800 text-brand-300 px-1.5 py-0.5 rounded">Reference Evidence</code>, keep all checked to extract all photos from all workbooks!
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Image className="w-4 h-4 text-brand-400" />
            Spreadsheet Columns ({sheet.headers.length}):
          </span>
          <span className="text-xs text-slate-400">
            {selectedMediaColumns.length} of {sheet.headers.length} columns selected
          </span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {sheet.headers.map((hName) => {
            const count = mediaCountByHeader.get(hName) || 0;
            const isSelected = selectedMediaColumns.includes(hName);
            const wbSet = workbooksByHeader.get(hName);

            return (
              <div
                key={hName}
                onClick={() => onToggleColumn(hName)}
                className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start justify-between ${
                  isSelected
                    ? 'border-brand-500 bg-brand-500/10 shadow-md shadow-brand-500/5'
                    : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className="mt-0.5 text-brand-400">
                    {isSelected ? <CheckSquare className="w-5 h-5 text-brand-400" /> : <Square className="w-5 h-5 text-slate-600" />}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-200 text-sm">{hName}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {count > 0 ? `${count} embedded photos` : 'No media detected'}
                    </p>

                    {wbSet && wbSet.size > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {Array.from(wbSet).map((wName, idx) => (
                          <span key={idx} className="px-1.5 py-0.5 rounded text-[9px] bg-slate-800 text-slate-300 border border-slate-700 font-mono truncate max-w-[130px]">
                            {wName}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {count > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex-shrink-0">
                    {count} photos
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sample Row Preview Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Table className="w-4 h-4 text-brand-400" />
            Sample Row Preview ({displaySampleRows.length} representative rows across all sheets)
          </h4>
          <span className="text-xs text-slate-400">
            Total {sheet.rowCount} rows detected across all loaded workbooks
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800 max-h-[360px]">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/80 text-slate-200 uppercase text-[10px] tracking-wider font-semibold sticky top-0">
              <tr>
                <th className="px-3 py-2.5">Row</th>
                <th className="px-3 py-2.5">Sheet / Workbook</th>
                {sheet.headers.map((h, idx) => (
                  <th key={idx} className="px-3 py-2.5 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
              {displaySampleRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-800/40">
                  <td className="px-3 py-2 font-mono text-slate-400">{row._rowNumber}</td>
                  <td className="px-3 py-2 font-sans text-slate-300 text-[11px] whitespace-nowrap">{row._sheetName || row._workbookName || 'Sheet'}</td>
                  {sheet.headers.map((h, cIdx) => {
                    const val = row[h];
                    const isMediaCol = selectedMediaColumns.includes(h);
                    const mediaInCell = anchors.find(a =>
                      a.row === row._rowNumber &&
                      a.colName === h &&
                      (a.sheetName === row._sheetName || a.workbookName === row._workbookName)
                    );

                    return (
                      <td key={cIdx} className={`px-3 py-2 ${isMediaCol ? 'bg-brand-500/5 font-medium' : ''}`}>
                        {mediaInCell ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[11px] border border-emerald-500/20 whitespace-nowrap">
                            <Image className="w-3 h-3" />
                            <span>Media ({mediaInCell.ext})</span>
                          </span>
                        ) : (
                          <span className="truncate max-w-[180px] inline-block font-mono text-slate-300">
                            {val !== undefined && val !== null ? String(val) : '—'}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedMediaColumns.length === 0 && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>Please select at least one media column to continue.</span>
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-slate-800">
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
        >
          ← Back to Sheet Select
        </button>

        <button
          onClick={onNext}
          disabled={selectedMediaColumns.length === 0}
          className="px-6 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-medium text-sm transition-colors shadow-lg shadow-brand-500/20"
        >
          Build Filename Pattern →
        </button>
      </div>
    </div>
  );
};
