import { ExtractedMediaAnchor, PatternToken } from '../../types';
import { sanitizeFilename } from '../security/sanitizer';

/**
 * Evaluates a list of pattern tokens against a specific Excel row object and media anchor.
 * Supports multi-workbook schema fallbacks so different workbooks produce clean, rich filenames.
 */
export function evaluateFilenamePattern(
  tokens: PatternToken[],
  rowObj: Record<string, any>,
  anchor: ExtractedMediaAnchor,
  mediaColumnName: string
): string {
  let parts: string[] = [];

  for (const token of tokens) {
    switch (token.type) {
      case 'column': {
        let val = rowObj[token.value];

        // Intelligent multi-workbook column fallback when workbooks have different header schemas
        if (val === undefined || val === null || String(val).trim() === '') {
          const targetLower = token.value.toLowerCase();
          // Attempt exact/fuzzy match across current row's available columns
          const altKey = Object.keys(rowObj).find(k => {
            if (k.startsWith('_')) return false;
            const kLower = k.toLowerCase();
            if (targetLower.includes('case') || targetLower.includes('record') || targetLower.includes('id')) {
              return kLower.includes('case') || kLower.includes('record') || kLower.includes('id') || kLower.includes('index');
            }
            if (targetLower.includes('date') || targetLower.includes('time')) {
              return kLower.includes('date') || kLower.includes('time');
            }
            if (targetLower.includes('video') || targetLower.includes('camera') || targetLower.includes('source')) {
              return kLower.includes('video') || kLower.includes('camera') || kLower.includes('source') || kLower.includes('site');
            }
            return false;
          });

          if (altKey && rowObj[altKey] !== undefined) {
            val = rowObj[altKey];
          }
        }

        const strVal = (val !== undefined && val !== null) ? String(val) : '';
        parts.push(strVal);
        break;
      }
      case 'text': {
        parts.push(token.value);
        break;
      }
      case 'mediaType': {
        const val = token.value || mediaColumnName;
        const normalized = val.toLowerCase().includes('face')
          ? 'detected'
          : val.toLowerCase().includes('poi')
          ? 'poi'
          : val.toLowerCase().replace(/[^a-z0-9]/g, '_');
        parts.push(normalized);
        break;
      }
      case 'rowNumber': {
        parts.push(String(anchor.row));
        break;
      }
      case 'originalName': {
        const origBase = anchor.mediaPath.split('/').pop() || 'media';
        const nameWithoutExt = origBase.substring(0, origBase.lastIndexOf('.')) || origBase;
        parts.push(nameWithoutExt);
        break;
      }
      case 'extension': {
        // Handled at final extension attachment
        break;
      }
    }
  }

  // Fallback to rich stem incorporating workbook name/row if all column tokens evaluated to empty
  let rawStem = parts.join('').trim();
  if (!rawStem || rawStem === '_' || /^_+$/.test(rawStem)) {
    const wbClean = anchor.workbookName
      ? anchor.workbookName.substring(0, anchor.workbookName.lastIndexOf('.')) || anchor.workbookName
      : 'Workbook';
    rawStem = `${wbClean}_Row${anchor.row}_${mediaColumnName}`;
  }

  const sanitizedStem = sanitizeFilename(rawStem, `media_row${anchor.row}`);
  return `${sanitizedStem}.${anchor.ext}`;
}

/**
 * Default preset pattern generator matching the build pack spec:
 * [Index]_[Video Information]_[Date & Time]_[Media Type]
 */
export function getDefaultPatternTokens(headers: string[]): PatternToken[] {
  const tokens: PatternToken[] = [];

  const indexHeader = headers.find(h => /^index$/i.test(h.trim()) || /id/i.test(h.trim())) || headers[0];
  const videoHeader = headers.find(h => /video|camera|site/i.test(h.trim()));
  const dateHeader = headers.find(h => /date|time/i.test(h.trim()));

  if (indexHeader) {
    tokens.push({ id: 't-1', type: 'column', value: indexHeader });
    tokens.push({ id: 't-2', type: 'text', value: '_' });
  }

  if (videoHeader) {
    tokens.push({ id: 't-3', type: 'column', value: videoHeader });
    tokens.push({ id: 't-4', type: 'text', value: '_' });
  }

  if (dateHeader) {
    tokens.push({ id: 't-5', type: 'column', value: dateHeader });
    tokens.push({ id: 't-6', type: 'text', value: '_' });
  }

  tokens.push({ id: 't-7', type: 'mediaType', value: '' });

  return tokens;
}
