import React, { useState, useRef } from 'react';
import { UploadCloud, ShieldAlert, AlertCircle, HelpCircle, Files } from 'lucide-react';
import { parseExcelWorkbook } from '../lib/ooxml/parser';
import { ParsedWorkbook } from '../types';
import { UniqueProcessingLoader } from './UniqueProcessingLoader';

interface Step1Props {
  onWorkbookParsed: (wb: ParsedWorkbook) => void;
}

export const Step1_FileUpload: React.FC<Step1Props> = ({ onWorkbookParsed }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>('Reading workbook archive...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = async (files: FileList | File[]) => {
    const fileList = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.xlsx'));

    if (fileList.length === 0) {
      setErrorMessage('Please select valid Excel workbooks (.xlsx file format).');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    // High-speed parallel workbook parsing (10 workbooks at a time)
    const CONCURRENCY_LIMIT = 10;
    const parsedWorkbooks: ParsedWorkbook[] = [];
    const errors: string[] = [];

    for (let i = 0; i < fileList.length; i += CONCURRENCY_LIMIT) {
      const chunk = fileList.slice(i, i + CONCURRENCY_LIMIT);
      setLoadingStatus(`Parallel parsing Excel workbooks ${i + 1} to ${Math.min(i + chunk.length, fileList.length)} of ${fileList.length}...`);

      const results = await Promise.all(
        chunk.map(async (file) => {
          try {
            const buffer = await file.arrayBuffer();
            const wb = await parseExcelWorkbook(buffer, file.name);
            return { wb, error: null };
          } catch (err: any) {
            return { wb: null, error: `${file.name}: ${err.message || 'Parsing error'}` };
          }
        })
      );

      for (const res of results) {
        if (res.wb && res.wb.sheets.length > 0) {
          parsedWorkbooks.push(res.wb);
        } else if (res.error) {
          errors.push(res.error);
        }
      }

      // Yield control for UI responsiveness
      await new Promise(r => setTimeout(r, 0));
    }

    setIsLoading(false);

    if (parsedWorkbooks.length === 0) {
      setErrorMessage(errors.join(' | ') || 'No readable worksheets found in selected files.');
      return;
    }

    // Merge multiple workbooks into unified master batch model
    if (parsedWorkbooks.length === 1) {
      const singleWb = parsedWorkbooks[0];
      for (const sName of Object.keys(singleWb.mediaAnchorsBySheet)) {
        singleWb.mediaAnchorsBySheet[sName] = singleWb.mediaAnchorsBySheet[sName].map(a => ({
          ...a,
          sheetName: sName,
          workbookName: singleWb.filename,
        }));
      }
      onWorkbookParsed(singleWb);
    } else {
      const masterSheets: ParsedWorkbook['sheets'] = [];
      const masterAnchorsBySheet: ParsedWorkbook['mediaAnchorsBySheet'] = {};
      let totalBytes = 0;

      for (const wb of parsedWorkbooks) {
        totalBytes += wb.sizeBytes;
        for (const sheet of wb.sheets) {
          const wbCleanName = wb.filename.substring(0, wb.filename.lastIndexOf('.')) || wb.filename;
          const uniqueSheetName = `${wbCleanName} / ${sheet.name}`;

          const decoratedSampleRows = sheet.sampleRows.map(r => ({
            ...r,
            _sheetName: uniqueSheetName,
            _workbookName: wb.filename,
          }));

          const decoratedSheet = {
            ...sheet,
            name: uniqueSheetName,
            sampleRows: decoratedSampleRows,
          };
          masterSheets.push(decoratedSheet);

          const sheetAnchors = wb.mediaAnchorsBySheet[sheet.name] || [];
          masterAnchorsBySheet[uniqueSheetName] = sheetAnchors.map(a => ({
            ...a,
            sheetName: uniqueSheetName,
            workbookName: wb.filename,
          }));
        }
      }

      const mergedWb: ParsedWorkbook = {
        filename: `Batch Queue (${parsedWorkbooks.length} Workbooks)`,
        sizeBytes: totalBytes,
        sheets: masterSheets,
        mediaAnchorsBySheet: masterAnchorsBySheet,
        rawZipFiles: {},
      };

      onWorkbookParsed(mergedWb);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <h2 className="text-2xl font-bold text-slate-100">Step 1: Upload Your Excel Files (High-Speed Multi-File Batch Mode)</h2>
        <p className="text-slate-400 text-sm">
          Select single or drag multiple heavy `.xlsx` Excel spreadsheets (2,800+ lines each, 90+ files).
        </p>
      </div>

      {/* Easy Language Guide Box */}
      <div className="bg-brand-500/10 border border-brand-500/30 rounded-2xl p-4 text-xs space-y-2 text-brand-200">
        <div className="flex items-center space-x-2 font-bold text-brand-300">
          <HelpCircle className="w-4 h-4 text-brand-400" />
          <span>💡 Quick Guide — High-Speed Parallel Multi-Workbook Extraction</span>
        </div>
        <p className="text-slate-300">
          <strong>Multi-File Selection:</strong> You can select or drag <strong>90+ Excel files at once</strong> onto the box below. All workbooks will be parsed in parallel micro-tasks.
        </p>
        <p className="text-slate-300">
          <strong>Example:</strong> Select your entire folder of 90 heavy `.xlsx` files (2,800+ lines each) to process and extract all photos in one fast run!
        </p>
      </div>

      {isLoading ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
          <UniqueProcessingLoader message={loadingStatus} subtext="High-speed parallel ZIP unpacking & media anchor mapping active..." />
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isLoading && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 ${
            isDragging
              ? 'border-brand-500 bg-brand-500/10 scale-[1.01]'
              : 'border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900/80'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xlsx"
            multiple
            className="hidden"
            disabled={isLoading}
          />

          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center">
              <UploadCloud className="w-8 h-8" />
            </div>

            <div>
              <p className="text-base font-semibold text-slate-200">
                Drop your Excel files (.xlsx) here
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Drag single file or select 90+ files together for batch extraction
              </p>
            </div>

            <div className="inline-flex items-center space-x-2 text-xs font-medium text-slate-400 bg-slate-800/60 px-3 py-1.5 rounded-full border border-slate-700/50">
              <Files className="w-3.5 h-3.5 text-brand-400" />
              <span>Supports batch selection of 90+ heavy `.xlsx` workbooks (2,800+ rows each)</span>
            </div>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start space-x-3 shadow-lg">
          <AlertCircle className="w-6 h-6 flex-shrink-0 text-rose-400 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-rose-200">File Processing Error</p>
            <p className="text-xs text-rose-300">{errorMessage}</p>
            <p className="text-xs text-rose-400 font-medium pt-1">
              💡 Advice: Please verify that all selected files are unencrypted `.xlsx` workbooks and try again.
            </p>
          </div>
        </div>
      )}

      <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center space-x-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
          <ShieldAlert className="w-4 h-4" />
          <span>Security & Confidentiality Guarantee</span>
        </div>
        <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
          <li><strong>Zero Cloud Upload:</strong> Your spreadsheets are opened locally inside your web browser. No files are uploaded to any server.</li>
          <li><strong>Complete Privacy:</strong> Your photos, cell text, and timestamps remain 100% confidential.</li>
        </ul>
      </div>
    </div>
  );
};
