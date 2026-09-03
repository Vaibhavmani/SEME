import React, { useState } from 'react';
import { PatternToken, SheetSummary, ExtractedMediaAnchor } from '../types';
import { evaluateFilenamePattern } from '../lib/pattern/engine';
import { Plus, Trash2, Tag, FileText, Hash, Eye, Sparkles, FolderTree, HelpCircle } from 'lucide-react';

interface Step4Props {
  sheet: SheetSummary;
  anchors: ExtractedMediaAnchor[];
  selectedMediaColumns: string[];
  tokens: PatternToken[];
  onUpdateTokens: (newTokens: PatternToken[]) => void;
  outputStructure: 'subfolders' | 'flat';
  onUpdateOutputStructure: (structure: 'subfolders' | 'flat') => void;
  onNext: () => void;
  onBack: () => void;
}

export const Step4_PatternBuilder: React.FC<Step4Props> = ({
  sheet,
  anchors,
  selectedMediaColumns,
  tokens,
  onUpdateTokens,
  outputStructure,
  onUpdateOutputStructure,
  onNext,
  onBack,
}) => {
  const [selectedHeaderToAdd, setSelectedHeaderToAdd] = useState<string>(sheet.headers[0] || '');
  const [customTextToAdd, setCustomTextToAdd] = useState<string>('_');

  const addToken = (token: PatternToken) => {
    onUpdateTokens([...tokens, token]);
  };

  const removeToken = (index: number) => {
    const updated = tokens.filter((_, i) => i !== index);
    onUpdateTokens(updated);
  };

  const addColumnToken = () => {
    if (!selectedHeaderToAdd) return;
    addToken({
      id: `token-${Date.now()}-${Math.random()}`,
      type: 'column',
      value: selectedHeaderToAdd,
    });
  };

  const addTextToken = () => {
    if (!customTextToAdd) return;
    addToken({
      id: `token-${Date.now()}-${Math.random()}`,
      type: 'text',
      value: customTextToAdd,
    });
  };

  // Generate live sample previews for up to 5 anchors
  React.useEffect(() => {
    if (sheet.headers.length > 0 && (!selectedHeaderToAdd || !sheet.headers.includes(selectedHeaderToAdd))) {
      setSelectedHeaderToAdd(sheet.headers[0]);
    }
  }, [sheet.headers]);

  // Pick representative sample anchors from each sheet/workbook
  const sampleAnchors: ExtractedMediaAnchor[] = [];
  const anchorsBySheetMap = new Map<string, ExtractedMediaAnchor[]>();
  anchors.forEach(a => {
    const key = a.sheetName || a.workbookName || 'Sheet';
    const list = anchorsBySheetMap.get(key) || [];
    list.push(a);
    anchorsBySheetMap.set(key, list);
  });
  anchorsBySheetMap.forEach(list => {
    sampleAnchors.push(...list.slice(0, 3));
  });
  const displaySampleAnchors = sampleAnchors.length > 0 ? sampleAnchors : anchors.slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <h2 className="text-2xl font-bold text-slate-100">Step 4: Build Filename Pattern</h2>
        <p className="text-slate-400 text-sm">
          Create the exact naming rule for your extracted photos using column details and text tokens.
        </p>
      </div>

      {/* Easy Language Guide Box */}
      <div className="bg-brand-500/10 border border-brand-500/30 rounded-2xl p-4 text-xs space-y-2 text-brand-200">
        <div className="flex items-center space-x-2 font-bold text-brand-300">
          <HelpCircle className="w-4 h-4 text-brand-400" />
          <span>💡 Quick Guide — How to complete Step 4</span>
        </div>
        <p className="text-slate-300">
          <strong>What to do:</strong> Add building blocks (tokens) to construct how each photo file will be named. Click <code>+ Add Column</code>, <code>+ Add Text</code>, or <code>+ Add Media Type</code>.
        </p>
        <p className="text-slate-300">
          <strong>Example Pattern:</strong> <code className="bg-slate-800 text-brand-300 px-1.5 py-0.5 rounded">[Index] _ [Video Information] _ [Date & Time] _ [Media Type]</code>
        </p>
        <p className="text-slate-300">
          <strong>Resulting Filename Preview:</strong> <code className="bg-slate-800 text-emerald-400 px-1.5 py-0.5 rounded font-mono">1_P84F118TOLOSTOYROAD_01-01-39_detected.jpeg</code>
        </p>
      </div>

      {/* Active Pattern Display */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-400" />
            Active Naming Rule:
          </label>
          <span className="text-xs text-slate-400">{tokens.length} token blocks added</span>
        </div>

        <div className="min-h-[64px] bg-slate-950 border border-slate-800/80 rounded-xl p-3 flex flex-wrap items-center gap-2">
          {tokens.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No tokens added yet. Use the controls below to add tokens.</p>
          ) : (
            tokens.map((token, idx) => (
              <div
                key={token.id}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 border border-slate-700 text-slate-200 group"
              >
                {token.type === 'column' && (
                  <span className="text-brand-400 font-semibold">[{token.value}]</span>
                )}
                {token.type === 'text' && (
                  <span className="text-emerald-400 font-mono">"{token.value}"</span>
                )}
                {token.type === 'mediaType' && (
                  <span className="text-amber-400 font-semibold">[Media Type]</span>
                )}
                {token.type === 'rowNumber' && (
                  <span className="text-purple-400 font-semibold">[Row Number]</span>
                )}
                {token.type === 'originalName' && (
                  <span className="text-cyan-400 font-semibold">[Original Name]</span>
                )}

                <button
                  onClick={() => removeToken(idx)}
                  className="text-slate-500 hover:text-rose-400 ml-1 transition-colors"
                  title="Remove this token"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Token Controls */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Add Building Blocks (Tokens)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Add Column Token */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-brand-400" />
              Column Token
            </label>
            <select
              value={selectedHeaderToAdd}
              onChange={(e) => setSelectedHeaderToAdd(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 p-2 focus:outline-none focus:border-brand-500"
            >
              {sheet.headers.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
            <button
              onClick={addColumnToken}
              className="w-full py-1.5 rounded-lg bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/30 text-xs font-medium flex items-center justify-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Column
            </button>
          </div>

          {/* Add Fixed Text */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              Fixed Separator / Text
            </label>
            <input
              type="text"
              value={customTextToAdd}
              onChange={(e) => setCustomTextToAdd(e.target.value)}
              placeholder="e.g. _ or -"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 p-2 focus:outline-none focus:border-brand-500 font-mono"
            />
            <button
              onClick={addTextToken}
              className="w-full py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-medium flex items-center justify-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Text
            </button>
          </div>

          {/* Add Special Tokens */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-amber-400" />
              Media Type Token
            </label>
            <p className="text-[11px] text-slate-400">Inserts detected / poi media tag</p>
            <button
              onClick={() => addToken({ id: `token-${Date.now()}`, type: 'mediaType', value: '' })}
              className="w-full py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-medium flex items-center justify-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Media Type
            </button>
          </div>

          {/* Add Row Number */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-purple-400" />
              Row Index Token
            </label>
            <p className="text-[11px] text-slate-400">Inserts Excel row number</p>
            <button
              onClick={() => addToken({ id: `token-${Date.now()}`, type: 'rowNumber', value: '' })}
              className="w-full py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 text-xs font-medium flex items-center justify-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Row Number
            </button>
          </div>
        </div>
      </div>

      {/* Output Directory Structure Choice */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <FolderTree className="w-4 h-4 text-brand-400" />
          Folder Structure Inside Downloaded ZIP
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label
            onClick={() => onUpdateOutputStructure('subfolders')}
            className={`p-3.5 rounded-xl border cursor-pointer flex items-center space-x-3 transition-all ${
              outputStructure === 'subfolders'
                ? 'border-brand-500 bg-brand-500/10 text-slate-100'
                : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700'
            }`}
          >
            <input
              type="radio"
              name="outStruct"
              checked={outputStructure === 'subfolders'}
              onChange={() => onUpdateOutputStructure('subfolders')}
              className="text-brand-500"
            />
            <div>
              <p className="text-xs font-semibold text-slate-200">Organize in Subfolders (Recommended)</p>
              <p className="text-[11px] text-slate-400">Creates subfolders for each media column: `Detected_Face/` and `POI_Image/`</p>
            </div>
          </label>

          <label
            onClick={() => onUpdateOutputStructure('flat')}
            className={`p-3.5 rounded-xl border cursor-pointer flex items-center space-x-3 transition-all ${
              outputStructure === 'flat'
                ? 'border-brand-500 bg-brand-500/10 text-slate-100'
                : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700'
            }`}
          >
            <input
              type="radio"
              name="outStruct"
              checked={outputStructure === 'flat'}
              onChange={() => onUpdateOutputStructure('flat')}
              className="text-brand-500"
            />
            <div>
              <p className="text-xs font-semibold text-slate-200">Single Flat Folder</p>
              <p className="text-[11px] text-slate-400">Places all extracted photos together inside one root folder</p>
            </div>
          </label>
        </div>
      </div>

      {/* Live Sample Previews */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Eye className="w-4 h-4 text-emerald-400" />
          Live Sample Preview (Actual Generated Filenames Across All Sheets)
        </h3>

        {displaySampleAnchors.length === 0 ? (
          <p className="text-xs text-slate-500 italic">No media anchors found for selected columns.</p>
        ) : (
          <div className="space-y-2">
            {displaySampleAnchors.map((anchor, idx) => {
              const rowObj = sheet.sampleRows.find(r =>
                r._rowNumber === anchor.row &&
                r._sheetName === anchor.sheetName &&
                r._workbookName === anchor.workbookName
              ) || sheet.sampleRows.find(r =>
                r._rowNumber === anchor.row &&
                (r._sheetName === anchor.sheetName || r._workbookName === anchor.workbookName)
              ) || sheet.sampleRows.find(r => r._rowNumber === anchor.row) || {};

              const generated = evaluateFilenamePattern(tokens, rowObj, anchor, anchor.colName);

              return (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-slate-500">{anchor.sheetName || anchor.workbookName || 'Sheet'} — Row {anchor.row} ({anchor.cellRef}):</span>
                    <span className="text-emerald-400 font-semibold">{generated}</span>
                  </div>
                  <span className="text-slate-400 text-[11px] font-sans bg-slate-800 px-2 py-0.5 rounded">
                    {anchor.colName}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-slate-800">
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
        >
          ← Back to Column Select
        </button>

        <button
          onClick={onNext}
          disabled={tokens.length === 0}
          className="px-6 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-medium text-sm transition-colors shadow-lg shadow-brand-500/20"
        >
          Preview All Generated Names →
        </button>
      </div>
    </div>
  );
};
