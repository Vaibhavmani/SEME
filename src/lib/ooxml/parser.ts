import { XMLParser } from 'fast-xml-parser';
import JSZip from 'jszip';
import { ExtractedMediaAnchor, ParsedWorkbook, SheetSummary } from '../../types';
import { validateAndLoadZip } from '../security/zipGuard';

/**
 * Normalizes relationship target paths relative to OOXML package directories.
 * Handles leading slashes (/xl/worksheets/sheet1.xml -> xl/worksheets/sheet1.xml)
 * and relative targets (../drawings/drawing1.xml -> xl/drawings/drawing1.xml).
 */
export function normalizeOoxmlPath(target: string, currentDir: string = 'xl'): string {
  if (!target) return '';

  // 1. Strip leading slash
  let clean = target.replace(/^\//, '');

  // 2. Handle relative navigation (e.g. "../drawings/drawing1.xml")
  if (clean.startsWith('../')) {
    const parentDir = currentDir.includes('/')
      ? currentDir.substring(0, currentDir.lastIndexOf('/'))
      : 'xl';
    clean = parentDir + '/' + clean.replace(/^\.\.\//, '');
  } else if (!clean.startsWith('xl/') && !clean.startsWith('docProps/') && !clean.startsWith('[Content_Types]')) {
    clean = currentDir ? `${currentDir}/${clean}` : `xl/${clean}`;
  }

  // Double slash cleanup
  return clean.replace(/\/+/g, '/');
}

/**
 * Resilient ZIP file lookup supporting case-insensitivity and path variations across all Excel exporters.
 */
export function findZipFile(zip: JSZip, targetPath: string): JSZip.JSZipObject | null {
  if (!targetPath) return null;

  const norm = normalizeOoxmlPath(targetPath);
  if (zip.file(norm)) return zip.file(norm);

  const cleanNoXl = norm.replace(/^xl\//i, '');
  const candidates = [
    norm,
    `xl/${cleanNoXl}`,
    cleanNoXl,
    norm.toLowerCase(),
    `xl/${cleanNoXl.toLowerCase()}`,
  ];

  for (const c of candidates) {
    const f = zip.file(c);
    if (f) return f;
  }

  // Fuzzy case-insensitive search across zip keys
  const targetKeyLower = cleanNoXl.toLowerCase();
  for (const key of Object.keys(zip.files)) {
    const keyNorm = key.replace(/^\//, '').replace(/^xl\//i, '').toLowerCase();
    if (keyNorm === targetKeyLower) {
      return zip.files[key];
    }
  }

  return null;
}

export function colToLetter(colIdx: number): string {
  let temp = colIdx;
  let letter = '';
  while (temp > 0) {
    let mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - mod) / 26);
  }
  return letter || 'A';
}

export function cellRefToColRow(cellRef: string): { col: number; row: number } {
  const match = cellRef.match(/^([A-Z]+)([0-9]+)$/i);
  if (!match) return { col: 1, row: 1 };

  const letters = match[1].toUpperCase();
  const row = parseInt(match[2], 10);

  let col = 0;
  for (let i = 0; i < letters.length; i++) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }

  return { col, row };
}

function getMimeType(ext: string): string {
  const e = ext.toLowerCase();
  switch (e) {
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'bmp': return 'image/bmp';
    case 'webp': return 'image/webp';
    case 'svg': return 'image/svg+xml';
    case 'tiff': return 'image/tiff';
    default: return 'application/octet-stream';
  }
}

function parseSharedStringsFast(xmlContent: string): string[] {
  const strings: string[] = [];
  const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/gi;
  const tRegex = /<t\b[^>]*>([\s\S]*?)<\/t>/gi;

  let match;
  while ((match = siRegex.exec(xmlContent)) !== null) {
    const siContent = match[1];
    let strVal = '';
    let tMatch;
    while ((tMatch = tRegex.exec(siContent)) !== null) {
      strVal += tMatch[1];
    }
    strVal = strVal
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&');
    strings.push(strVal);
  }
  return strings;
}

/**
 * Decoupled OOXML Workbook Parser.
 * Worksheet validation is independent from drawing/media extraction.
 */
export async function parseExcelWorkbook(
  fileBuffer: ArrayBuffer,
  filename: string,
  onProgress?: (status: string) => void
): Promise<ParsedWorkbook> {
  onProgress?.('Validating archive package...');
  const zip = await validateAndLoadZip(fileBuffer);

  const xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
    parseAttributeValue: false,
    parseTagValue: false,
  });

  // 1. Shared Strings Table
  onProgress?.('Reading shared text table...');
  let sharedStrings: string[] = [];
  const sharedStringsFile = findZipFile(zip, 'xl/sharedStrings.xml');
  if (sharedStringsFile) {
    try {
      const xmlContent = await sharedStringsFile.async('string');
      sharedStrings = parseSharedStringsFast(xmlContent);
    } catch (e) {
      // Continue if shared strings cannot be read
    }
  }

  // 2. Workbook Relationships & Sheets
  onProgress?.('Parsing workbook structure...');
  const workbookFile = findZipFile(zip, 'xl/workbook.xml');
  const workbookRelsFile = findZipFile(zip, 'xl/_rels/workbook.xml.rels');

  const wbRelsMap: Record<string, string> = {};

  if (workbookRelsFile) {
    try {
      const wbRelsXml = xmlParser.parse(await workbookRelsFile.async('string'));
      const rels = wbRelsXml.Relationships?.Relationship;
      if (rels) {
        const relArray = Array.isArray(rels) ? rels : [rels];
        for (const r of relArray) {
          const id = r['@_Id'] || r['@_id'];
          const target = r['@_Target'] || r['@_target'];
          if (id && target) {
            wbRelsMap[id] = target;
          }
        }
      }
    } catch (e) {
      // Continue with default targets
    }
  }

  const sheetEntries: { name: string; targetPath: string }[] = [];

  if (workbookFile) {
    try {
      const wbXml = xmlParser.parse(await workbookFile.async('string'));
      const sheetsNode = wbXml.workbook?.sheets?.sheet;
      if (sheetsNode) {
        const sArray = Array.isArray(sheetsNode) ? sheetsNode : [sheetsNode];
        for (const s of sArray) {
          const name = s['@_name'] || 'Sheet';
          const rId = s['@_id'] || s['@_r:id'];
          const rawTarget = wbRelsMap[rId] || `worksheets/sheet${s['@_sheetId'] || 1}.xml`;
          const targetPath = normalizeOoxmlPath(rawTarget, 'xl');
          sheetEntries.push({ name, targetPath });
        }
      }
    } catch (e) {
      // Fall back to folder scanning
    }
  }

  // Fallback sheet discovery if workbook.xml failed or yielded no sheets
  if (sheetEntries.length === 0) {
    for (const key of Object.keys(zip.files)) {
      const normKey = key.replace(/^\//, '');
      if (normKey.match(/^(xl\/)?worksheets\/sheet\d+\.xml$/i)) {
        const numMatch = normKey.match(/\d+/);
        const sheetNum = numMatch ? numMatch[0] : '1';
        sheetEntries.push({
          name: `Sheet ${sheetNum}`,
          targetPath: normKey,
        });
      }
    }
  }

  if (sheetEntries.length === 0) {
    throw new Error('No worksheets found in this workbook. The file may be empty or encrypted.');
  }

  const sheets: SheetSummary[] = [];
  const mediaAnchorsBySheet: Record<string, ExtractedMediaAnchor[]> = {};

  // 3. Process Each Worksheet (INDEPENDENT VALIDATION)
  for (let sIdx = 0; sIdx < sheetEntries.length; sIdx++) {
    const entry = sheetEntries[sIdx];
    onProgress?.(`Parsing worksheet ${sIdx + 1} of ${sheetEntries.length} (${entry.name})...`);

    const sheetFile = findZipFile(zip, entry.targetPath);
    if (!sheetFile) continue;

    let parsedSheet: any;
    try {
      const sheetXmlContent = await sheetFile.async('string');
      parsedSheet = xmlParser.parse(sheetXmlContent);
    } catch (err) {
      // If a single worksheet XML is corrupt, skip it cleanly
      continue;
    }

    // Extract Rows and Cells
    const rowMap = new Map<number, Map<number, any>>();
    let maxRow = 0;
    let maxCol = 0;

    const sheetData = parsedSheet.worksheet?.sheetData;
    if (sheetData && sheetData.row) {
      const rows = Array.isArray(sheetData.row) ? sheetData.row : [sheetData.row];
      for (const r of rows) {
        const rIdx = parseInt(r['@_r'], 10);
        if (isNaN(rIdx)) continue;
        if (rIdx > maxRow) maxRow = rIdx;

        let colMap = rowMap.get(rIdx);
        if (!colMap) {
          colMap = new Map();
          rowMap.set(rIdx, colMap);
        }

        if (r.c) {
          const cells = Array.isArray(r.c) ? r.c : [r.c];
          for (const c of cells) {
            const cellRef = c['@_r'];
            const { col } = cellRefToColRow(cellRef);
            if (col > maxCol) maxCol = col;

            const tType = c['@_t'];
            let rawVal = c.v;
            if (rawVal !== undefined && typeof rawVal === 'object' && rawVal['#text'] !== undefined) {
              rawVal = rawVal['#text'];
            }

            let cellValue: any = rawVal;

            if (tType === 's' && rawVal !== undefined) {
              const strIdx = parseInt(String(rawVal), 10);
              cellValue = sharedStrings[strIdx] ?? '';
            } else if (tType === 'inlineStr' && c.is) {
              cellValue = c.is.t ?? c.is.t?.['#text'] ?? '';
            }

            colMap.set(col, cellValue);
          }
        }
      }
    }

    // Extract Headers
    const headerRowIdx = rowMap.has(1) ? 1 : (rowMap.keys().next().value || 1);
    const headerColMap = rowMap.get(headerRowIdx) || new Map();
    const headers: string[] = [];

    for (let c = 1; c <= maxCol; c++) {
      const val = headerColMap.get(c);
      const hText = (val !== undefined && val !== null && String(val).trim() !== '')
        ? String(val).trim()
        : `Column ${colToLetter(c)}`;
      headers.push(hText);
    }

    // Extract Data Rows
    const sampleRows: Record<string, any>[] = [];
    const allRowIndices = Array.from(rowMap.keys()).sort((a, b) => a - b);
    const dataRowIndices = allRowIndices.filter(r => r > headerRowIdx);

    for (const rIdx of dataRowIndices) {
      const rowDataMap = rowMap.get(rIdx)!;
      const rowObj: Record<string, any> = {
        _rowNumber: rIdx,
        _sheetName: entry.name,
        _workbookName: filename,
      };
      for (let c = 1; c <= headers.length; c++) {
        const hName = headers[c - 1];
        rowObj[hName] = rowDataMap.get(c) ?? '';
      }
      sampleRows.push(rowObj);
    }

    // 4. DECOUPLED DRAWING & MEDIA EXTRACTION
    // Failure in media extraction MUST NOT invalidate the worksheet!
    const sheetMediaAnchors: ExtractedMediaAnchor[] = [];

    try {
      const targetDir = entry.targetPath.includes('/')
        ? entry.targetPath.substring(0, entry.targetPath.lastIndexOf('/'))
        : 'xl/worksheets';
      const sheetFileName = entry.targetPath.split('/').pop()!;
      const sheetRelsPath = `${targetDir}/_rels/${sheetFileName}.rels`;
      const sheetRelsFile = findZipFile(zip, sheetRelsPath);

      if (sheetRelsFile) {
        const sheetRelsXml = xmlParser.parse(await sheetRelsFile.async('string'));
        const sRels = sheetRelsXml.Relationships?.Relationship;
        if (sRels) {
          const sRelArray = Array.isArray(sRels) ? sRels : [sRels];
          for (const rel of sRelArray) {
            const type = rel['@_Type'] || rel['@_type'] || '';
            const rawTarget = rel['@_Target'] || rel['@_target'] || '';

            if (type.endsWith('/drawing')) {
              const drawingPath = normalizeOoxmlPath(rawTarget, targetDir);
              const drawingFile = findZipFile(zip, drawingPath);
              if (!drawingFile) continue;

              const dDir = drawingPath.includes('/')
                ? drawingPath.substring(0, drawingPath.lastIndexOf('/'))
                : 'xl/drawings';
              const dFileName = drawingPath.split('/').pop()!;
              const dRelsPath = `${dDir}/_rels/${dFileName}.rels`;
              const dRelsFile = findZipFile(zip, dRelsPath);

              const drawingRelsMap: Record<string, string> = {};
              if (dRelsFile) {
                const dRelsXml = xmlParser.parse(await dRelsFile.async('string'));
                const dRels = dRelsXml.Relationships?.Relationship;
                if (dRels) {
                  const dRelArray = Array.isArray(dRels) ? dRels : [dRels];
                  for (const dr of dRelArray) {
                    const id = dr['@_Id'] || dr['@_id'];
                    const medRaw = dr['@_Target'] || dr['@_target'];
                    if (id && medRaw) {
                      drawingRelsMap[id] = normalizeOoxmlPath(medRaw, dDir);
                    }
                  }
                }
              }

              // Parse Drawing XML for anchors
              const drawingXmlContent = await drawingFile.async('string');
              const parsedDrawing = xmlParser.parse(drawingXmlContent);
              const wsDr = parsedDrawing.wsDr;

              if (wsDr) {
                const anchors: { type: 'twoCellAnchor' | 'oneCellAnchor'; node: any }[] = [];

                if (wsDr.twoCellAnchor) {
                  const arr = Array.isArray(wsDr.twoCellAnchor) ? wsDr.twoCellAnchor : [wsDr.twoCellAnchor];
                  arr.forEach((node: any) => anchors.push({ type: 'twoCellAnchor', node }));
                }
                if (wsDr.oneCellAnchor) {
                  const arr = Array.isArray(wsDr.oneCellAnchor) ? wsDr.oneCellAnchor : [wsDr.oneCellAnchor];
                  arr.forEach((node: any) => anchors.push({ type: 'oneCellAnchor', node }));
                }

                for (const anchor of anchors) {
                  const fromNode = anchor.node.from;
                  if (!fromNode) continue;

                  const rawCol = parseInt(fromNode.col?.['#text'] ?? fromNode.col, 10);
                  const rawRow = parseInt(fromNode.row?.['#text'] ?? fromNode.row, 10);

                  if (isNaN(rawCol) || isNaN(rawRow)) continue;

                  const col = rawCol + 1; // 1-indexed Excel Col
                  const row = rawRow + 1; // 1-indexed Excel Row
                  const colLetter = colToLetter(col);
                  const cellRef = `${colLetter}${row}`;
                  const colName = headers[col - 1] || `Column ${colLetter}`;

                  let blipId: string | null = null;
                  const picNode = anchor.node.pic;
                  if (picNode && picNode.blipFill && picNode.blipFill.blip) {
                    blipId = picNode.blipFill.blip['@_embed'] || picNode.blipFill.blip['@_r:embed'];
                  }

                  if (blipId && drawingRelsMap[blipId]) {
                    const mediaPath = drawingRelsMap[blipId];
                    const zipEntry = findZipFile(zip, mediaPath);

                    if (zipEntry) {
                      const ext = mediaPath.split('.').pop() || 'png';
                      sheetMediaAnchors.push({
                        row,
                        col,
                        colName,
                        cellRef,
                        mediaPath,
                        ext,
                        mimeType: getMimeType(ext),
                        zipEntry,
                        anchorType: anchor.type,
                        sheetName: entry.name,
                        workbookName: filename,
                      });
                    }
                  }
                }
              }
            }
          }
        }
      }
    } catch (drawingError) {
      // Drawing extraction errors are caught silently so worksheet remains 100% valid!
    }

    mediaAnchorsBySheet[entry.name] = sheetMediaAnchors;

    // Worksheet accepted as valid!
    sheets.push({
      name: entry.name,
      rowCount: dataRowIndices.length,
      columnCount: headers.length,
      headers,
      sampleRows,
      hasImages: sheetMediaAnchors.length > 0,
      imageCount: sheetMediaAnchors.length,
    });
  }

  if (sheets.length === 0) {
    throw new Error('No valid worksheets could be processed from this Excel file.');
  }

  return {
    filename,
    sizeBytes: fileBuffer.byteLength,
    sheets,
    mediaAnchorsBySheet,
    rawZipFiles: {},
  };
}
