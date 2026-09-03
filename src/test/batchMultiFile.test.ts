import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseExcelWorkbook } from '../lib/ooxml/parser';
import { ParsedWorkbook, ExtractedMediaAnchor, SheetSummary } from '../types';
import { getDefaultPatternTokens } from '../lib/pattern/engine';

describe('Verify All Columns From All Sheets across Workbooks', () => {
  it('should include all columns from File 1 (Sheets 1 & 2) and File 2 (Sheets 1 & 2)', async () => {
    const f1Path = path.resolve(process.cwd(), 'Realistic_Excel_Media_Stress_Test.xlsx');
    const f2Path = path.resolve(process.cwd(), 'Secure_Media_Extractor_Test.xlsx');

    const wb1 = await parseExcelWorkbook(fs.readFileSync(f1Path).buffer, 'Realistic_Excel_Media_Stress_Test.xlsx');
    const wb2 = await parseExcelWorkbook(fs.readFileSync(f2Path).buffer, 'Secure_Media_Extractor_Test.xlsx');

    const parsedWorkbooks = [wb1, wb2];

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

    // Select ALL sheets across all workbooks
    const selectedSheetNames = mergedWb.sheets.map(s => s.name);
    expect(selectedSheetNames.length).toBe(4); // 2 sheets from File 1 + 2 sheets from File 2

    const aggregatedSheets: SheetSummary[] = mergedWb.sheets.filter(s => selectedSheetNames.includes(s.name));
    const aggregatedHeaders = Array.from(new Set(aggregatedSheets.flatMap(s => s.headers)));

    console.log('All aggregated headers count:', aggregatedHeaders.length);
    console.log('All aggregated headers list:', aggregatedHeaders);

    // Verify unique headers from File 2 Sheet 2 ('Event Time', 'Evidence Photo') are included!
    expect(aggregatedHeaders).toContain('Event Time');
    expect(aggregatedHeaders).toContain('Evidence Photo');
    expect(aggregatedHeaders).toContain('Face Evidence');
    expect(aggregatedHeaders).toContain('Reference Evidence');
  });
});
