import { useState } from 'react';
import { ParsedWorkbook, ExtractedMediaAnchor, PatternToken, DuplicatePolicy, ExtractionResult, PreExtractionItem, SheetSummary } from './types';
import { Navbar } from './components/Navbar';
import { Step1_FileUpload } from './components/Step1_FileUpload';
import { Step2_SheetSelect } from './components/Step2_SheetSelect';
import { Step3_ColumnMap } from './components/Step3_ColumnMap';
import { Step4_PatternBuilder } from './components/Step4_PatternBuilder';
import { Step5_PreExtractionPreview } from './components/Step5_PreExtractionPreview';
import { Step6_ExtractionProgress } from './components/Step6_ExtractionProgress';
import { Step7_Results } from './components/Step7_Results';
import { getDefaultPatternTokens } from './lib/pattern/engine';
import { CheckCircle2 } from 'lucide-react';

export function App() {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [workbook, setWorkbook] = useState<ParsedWorkbook | null>(null);
  const [selectedSheetNames, setSelectedSheetNames] = useState<string[]>([]);
  const [selectedMediaColumns, setSelectedMediaColumns] = useState<string[]>([]);
  const [tokens, setTokens] = useState<PatternToken[]>([]);
  const [outputStructure, setOutputStructure] = useState<'subfolders' | 'flat'>('subfolders');
  const [duplicatePolicy, setDuplicatePolicy] = useState<DuplicatePolicy>('auto-suffix');
  const [preparedItems, setPreparedItems] = useState<PreExtractionItem[]>([]);
  const [result, setResult] = useState<ExtractionResult | null>(null);

  // Clear data handler
  const handleClearData = () => {
    setWorkbook(null);
    setSelectedSheetNames([]);
    setSelectedMediaColumns([]);
    setTokens([]);
    setPreparedItems([]);
    setResult(null);
    setCurrentStep(1);
  };

  // Workbook parsed handler
  const handleWorkbookParsed = (wb: ParsedWorkbook) => {
    setWorkbook(wb);
    // Select ALL sheets by default so columns from all sheets/workbooks are fetched and displayed
    const defaultSheets = wb.sheets.map(s => s.name);
    setSelectedSheetNames(defaultSheets);

    // Aggregate ALL anchors across ALL selected sheets
    const allAnchors: ExtractedMediaAnchor[] = [];
    defaultSheets.forEach(sName => {
      const anchors = wb.mediaAnchorsBySheet[sName] || [];
      anchors.forEach(a => allAnchors.push({ ...a, sheetName: sName, workbookName: a.workbookName || wb.filename }));
    });

    // Automatically select ALL unique media columns present across any sheet/workbook
    const imageCols = Array.from(new Set(allAnchors.map(a => a.colName)));
    const allHeaders = Array.from(new Set(wb.sheets.flatMap(s => s.headers)));
    setSelectedMediaColumns(imageCols.length > 0 ? imageCols : allHeaders.slice(0, 2));

    // Preset tokens matching specs
    setTokens(getDefaultPatternTokens(allHeaders));
    setCurrentStep(2);
  };

  // Select Sheets handler
  const handleSelectSheets = (sheetNames: string[]) => {
    setSelectedSheetNames(sheetNames);
    if (workbook) {
      const allAnchors: ExtractedMediaAnchor[] = [];
      sheetNames.forEach(sName => {
        const anchors = workbook.mediaAnchorsBySheet[sName] || [];
        anchors.forEach(a => allAnchors.push({ ...a, sheetName: sName, workbookName: a.workbookName || workbook.filename }));
      });

      const imageCols = Array.from(new Set(allAnchors.map(a => a.colName)));
      const selectedSheets = workbook.sheets.filter(s => sheetNames.includes(s.name));
      const aggregatedHeaders = Array.from(new Set(selectedSheets.flatMap(s => s.headers)));

      setSelectedMediaColumns(imageCols.length > 0 ? imageCols : aggregatedHeaders.slice(0, 2));
      setTokens(getDefaultPatternTokens(aggregatedHeaders));
    }
  };

  // Toggle column selection
  const handleToggleColumn = (colName: string) => {
    if (selectedMediaColumns.includes(colName)) {
      setSelectedMediaColumns(selectedMediaColumns.filter(c => c !== colName));
    } else {
      setSelectedMediaColumns([...selectedMediaColumns, colName]);
    }
  };

  // Aggregate selected sheets summary & anchors for Step 3 - Step 6
  const aggregatedSheets: SheetSummary[] = workbook
    ? workbook.sheets.filter(s => selectedSheetNames.includes(s.name))
    : [];

  const aggregatedHeaders = Array.from(
    new Set(aggregatedSheets.flatMap(s => s.headers))
  );

  const aggregatedAnchors: ExtractedMediaAnchor[] = [];
  if (workbook) {
    selectedSheetNames.forEach(sName => {
      const anchors = workbook.mediaAnchorsBySheet[sName] || [];
      anchors.forEach(a => {
        aggregatedAnchors.push({
          ...a,
          sheetName: a.sheetName || sName,
          workbookName: a.workbookName || workbook.filename,
        });
      });
    });
  }

  const combinedSheetSummary: SheetSummary = {
    name: selectedSheetNames.length > 1 ? `Batch Queue (${selectedSheetNames.length} Sheets)` : (selectedSheetNames[0] || 'Sheet'),
    rowCount: aggregatedSheets.reduce((sum, s) => sum + s.rowCount, 0),
    columnCount: aggregatedHeaders.length,
    headers: aggregatedHeaders,
    sampleRows: aggregatedSheets.flatMap(s => s.sampleRows),
    hasImages: aggregatedAnchors.length > 0,
    imageCount: aggregatedAnchors.length,
  };

  const stepsList = [
    { num: 1, label: 'Workbook' },
    { num: 2, label: 'Worksheet' },
    { num: 3, label: 'Media Columns' },
    { num: 4, label: 'Pattern Builder' },
    { num: 5, label: 'Preview' },
    { num: 6, label: 'Extract' },
    { num: 7, label: 'Results' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Navbar onClearData={handleClearData} hasLoadedFile={!!workbook} />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Step Indicator Progress Bar */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between overflow-x-auto gap-2 pb-1 scrollbar-none">
            {stepsList.map((step) => {
              const isCurrent = step.num === currentStep;
              const isCompleted = step.num < currentStep;

              return (
                <div key={step.num} className="flex items-center space-x-2 flex-shrink-0">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isCurrent
                        ? 'bg-brand-500 text-white ring-4 ring-brand-500/20 shadow-lg shadow-brand-500/30'
                        : isCompleted
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-500 border border-slate-700'
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : step.num}
                  </div>
                  <span className={`text-xs font-medium whitespace-nowrap ${
                    isCurrent ? 'text-slate-100 font-semibold' : isCompleted ? 'text-slate-300' : 'text-slate-500'
                  }`}>
                    {step.label}
                  </span>
                  {step.num < stepsList.length && (
                    <div className="w-6 sm:w-10 h-0.5 bg-slate-800" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Dynamic Step View Rendering */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 sm:p-8 backdrop-blur-sm">
          {currentStep === 1 && (
            <Step1_FileUpload onWorkbookParsed={handleWorkbookParsed} />
          )}

          {currentStep === 2 && workbook && (
            <Step2_SheetSelect
              workbook={workbook}
              selectedSheetNames={selectedSheetNames}
              onSelectSheets={handleSelectSheets}
              onNext={() => setCurrentStep(3)}
              onBack={() => setCurrentStep(1)}
            />
          )}

          {currentStep === 3 && workbook && (
            <Step3_ColumnMap
              sheet={combinedSheetSummary}
              anchors={aggregatedAnchors}
              selectedMediaColumns={selectedMediaColumns}
              onToggleColumn={handleToggleColumn}
              onNext={() => setCurrentStep(4)}
              onBack={() => setCurrentStep(2)}
            />
          )}

          {currentStep === 4 && workbook && (
            <Step4_PatternBuilder
              sheet={combinedSheetSummary}
              anchors={aggregatedAnchors}
              selectedMediaColumns={selectedMediaColumns}
              tokens={tokens}
              onUpdateTokens={setTokens}
              outputStructure={outputStructure}
              onUpdateOutputStructure={setOutputStructure}
              onNext={() => setCurrentStep(5)}
              onBack={() => setCurrentStep(3)}
            />
          )}

          {currentStep === 5 && workbook && (
            <Step5_PreExtractionPreview
              sheet={combinedSheetSummary}
              anchors={aggregatedAnchors}
              selectedMediaColumns={selectedMediaColumns}
              tokens={tokens}
              duplicatePolicy={duplicatePolicy}
              onUpdateDuplicatePolicy={setDuplicatePolicy}
              onStartExtraction={(items) => {
                setPreparedItems(items);
                setCurrentStep(6);
              }}
              onBack={() => setCurrentStep(4)}
            />
          )}

          {currentStep === 6 && workbook && (
            <Step6_ExtractionProgress
              workbookName={workbook.filename}
              sheetName={combinedSheetSummary.name}
              selectedMediaColumns={selectedMediaColumns}
              tokens={tokens}
              items={preparedItems}
              outputStructure={outputStructure}
              onComplete={(res) => {
                setResult(res);
                setCurrentStep(7);
              }}
              onCancel={() => setCurrentStep(5)}
            />
          )}

          {currentStep === 7 && result && (
            <Step7_Results result={result} onClearData={handleClearData} />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
