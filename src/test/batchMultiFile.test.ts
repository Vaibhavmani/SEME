import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseExcelWorkbook } from '../lib/ooxml/parser';
import { ParsedWorkbook, ExtractedMediaAnchor, SheetSummary } from '../types';
import { evaluateFilenamePattern, getDefaultPatternTokens } from '../lib/pattern/engine';

describe('Multi-File Batch Extraction Fix Verification', () => {
  it('should correctly attach _sheetName and _workbookName to sampleRows and match them per workbook', async () => {
    const f1Path = path.resolve(process.cwd(), 'Realistic_Excel_Media_Stress_Test.xlsx');
    const f2Path = path.resolve(process.cwd(), 'Secure_Media_Extractor_Test.xlsx');

    const buf1 = fs.readFileSync(f1Path);
    const buf2 = fs.readFileSync(f2Path);

    const wb1 = await parseExcelWorkbook(buf1.buffer, 'Realistic_Excel_Media_Stress_Test.xlsx');
    const wb2 = await parseExcelWorkbook(buf2.buffer, 'Secure_Media_Extractor_Test.xlsx');

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

    const selectedSheetNames = mergedWb.sheets.filter(s => s.hasImages).map(s => s.name);
    const aggregatedSheets: SheetSummary[] = mergedWb.sheets.filter(s => selectedSheetNames.includes(s.name));
    const aggregatedHeaders = Array.from(new Set(aggregatedSheets.flatMap(s => s.headers)));

    const aggregatedAnchors: ExtractedMediaAnchor[] = [];
    selectedSheetNames.forEach(sName => {
      const anchors = mergedWb.mediaAnchorsBySheet[sName] || [];
      anchors.forEach(a => {
        aggregatedAnchors.push({
          ...a,
          sheetName: a.sheetName || sName,
          workbookName: a.workbookName || mergedWb.filename,
        });
      });
    });

    const combinedSheetSummary: SheetSummary = {
      name: `Batch Queue (${selectedSheetNames.length} Sheets)`,
      rowCount: aggregatedSheets.reduce((sum, s) => sum + s.rowCount, 0),
      columnCount: aggregatedHeaders.length,
      headers: aggregatedHeaders,
      sampleRows: aggregatedSheets.flatMap(s => s.sampleRows),
      hasImages: aggregatedAnchors.length > 0,
      imageCount: aggregatedAnchors.length,
    };

    const tokens = getDefaultPatternTokens(aggregatedHeaders);

    const selectedMediaColumns = Array.from(new Set(aggregatedAnchors.map(a => a.colName)));
    const activeAnchors = aggregatedAnchors.filter(a => selectedMediaColumns.includes(a.colName));

    const rawItems = activeAnchors.map((anchor, idx) => {
      const rowObj = combinedSheetSummary.sampleRows.find(r =>
        r._rowNumber === anchor.row &&
        r._sheetName === anchor.sheetName &&
        r._workbookName === anchor.workbookName
      ) || combinedSheetSummary.sampleRows.find(r =>
        r._rowNumber === anchor.row &&
        (r._sheetName === anchor.sheetName || r._workbookName === anchor.workbookName)
      ) || combinedSheetSummary.sampleRows.find(r => r._rowNumber === anchor.row) || {};

      const generated = evaluateFilenamePattern(tokens, rowObj, anchor, anchor.colName);
      return {
        id: `item-${idx}`,
        rowNumber: anchor.row,
        targetName: generated,
        anchor,
        sheetName: anchor.sheetName || anchor.workbookName || combinedSheetSummary.name,
        workbookName: anchor.workbookName || '',
        rowObj,
      };
    });

    const wb2Items = rawItems.filter(i => i.workbookName === 'Secure_Media_Extractor_Test.xlsx');

    // Assert that every WB2 item matched a rowObj belonging to WB2!
    wb2Items.forEach(item => {
      expect(item.rowObj._workbookName).toBe('Secure_Media_Extractor_Test.xlsx');
    });

    expect(wb2Items.length).toBe(7);
  });
});
