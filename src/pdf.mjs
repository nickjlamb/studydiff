// PDF text extraction for uploaded papers. Pure-JS (unpdf/pdf.js) so it runs on
// any host with no system libraries. Returns plain text plus a little metadata;
// scanned (image-only) PDFs yield no text and are reported as such rather than
// silently producing an empty comparison.

import { extractText, getDocumentProxy } from 'unpdf';

// Cap the text we feed downstream so a 30-page paper can't blow up cost/latency.
// Methods/results (what StudyDiff needs) sit well within this.
const MAX_CHARS = Number(process.env.MAX_PDF_CHARS) || 60000;

/**
 * @param {Uint8Array|Buffer} bytes  raw PDF bytes
 * @returns {Promise<{text:string, pages:number, chars:number, truncated:boolean}>}
 */
export async function pdfToText(bytes) {
  // Copy into a fresh Uint8Array: a Node Buffer is a view into a shared pool, and
  // pdf.js reads the whole underlying ArrayBuffer unless we give it a clean copy.
  const data = Uint8Array.from(bytes);
  // Cheap signature check – reject anything that isn't a PDF up front.
  if (data.length < 5 || String.fromCharCode(data[0], data[1], data[2], data[3]) !== '%PDF') {
    throw new Error('That file does not look like a PDF.');
  }
  let doc;
  try {
    doc = await getDocumentProxy(data);
  } catch {
    throw new Error('Could not read that PDF – it may be corrupted or password-protected.');
  }
  const { text, totalPages } = await extractText(doc, { mergePages: true });
  const clean = String(text || '').replace(/\s+\n/g, '\n').replace(/[ \t]{2,}/g, ' ').trim();
  if (clean.length < 40) {
    throw new Error('No selectable text found – this PDF may be scanned images. Paste the text instead, or use a text-based PDF.');
  }
  const truncated = clean.length > MAX_CHARS;
  return {
    text: truncated ? clean.slice(0, MAX_CHARS) : clean,
    pages: totalPages,
    chars: clean.length,
    truncated,
  };
}
