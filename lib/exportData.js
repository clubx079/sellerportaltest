// Client-side export helpers for DeelMap analytics (CSV + branded PDF).
// No server dependency — CSV is built by hand, PDF uses jspdf + jspdf-autotable.

const BRAND = 'DeelMap';
const BRAND_RED = [208, 56, 57]; // #D03839
const INK = [26, 24, 22]; // #1A1816
const MUTED = [115, 115, 112]; // #737370

function escapeCSVValue(val) {
  if (val == null) return '';
  const s = String(val);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// rows: array of objects (keys become headers) OR { columns: [...], data: [[...], ...] }
function normalizeRows(rows) {
  if (rows && Array.isArray(rows.columns) && Array.isArray(rows.data)) {
    return { columns: rows.columns, data: rows.data };
  }
  const arr = Array.isArray(rows) ? rows : [];
  const columns = arr.length ? Object.keys(arr[0]) : [];
  const data = arr.map((r) => columns.map((c) => r[c]));
  return { columns, data };
}

/**
 * Build a CSV (with Excel BOM) and trigger a client download.
 * @param {string} filename e.g. "deelmap-analytics-2026-06-10.csv"
 * @param {Array<Object>|{columns:string[],data:any[][]}} rows
 */
export function downloadCSV(filename, rows) {
  const { columns, data } = normalizeRows(rows);
  const lines = [];
  lines.push(columns.map(escapeCSVValue).join(','));
  for (const row of data) {
    lines.push(row.map(escapeCSVValue).join(','));
  }
  const csv = '﻿' + lines.join('\r\n'); // BOM for Excel
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename);
}

/**
 * Build a clean branded PDF and trigger a client download.
 * @param {string} filename e.g. "deelmap-analytics-2026-06-10.pdf"
 * @param {{ title: string, sections: Array<{ heading?: string, columns: string[], rows: any[][] }> }} opts
 */
export async function downloadPDF(filename, { title, sections = [] }) {
  const { default: jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 40;

  // Brand header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...BRAND_RED);
  doc.text(BRAND, marginX, 46);

  // Title
  doc.setFontSize(13);
  doc.setTextColor(...INK);
  doc.text(title || 'Analytics Report', marginX, 68);

  // Generated date
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(
    `Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
    marginX,
    84
  );

  // Divider
  doc.setDrawColor(232, 232, 228); // #E8E8E4
  doc.line(marginX, 94, pageWidth - marginX, 94);

  let cursorY = 112;
  for (const section of sections) {
    if (section.heading) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...INK);
      doc.text(section.heading, marginX, cursorY);
      cursorY += 8;
    }
    autoTable(doc, {
      startY: cursorY + 4,
      head: section.columns ? [section.columns] : undefined,
      body: section.rows || [],
      margin: { left: marginX, right: marginX },
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 5, textColor: INK },
      headStyles: { fillColor: BRAND_RED, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 250, 248] }, // #FAFAF8
    });
    cursorY = (doc.lastAutoTable?.finalY || cursorY) + 24;
  }

  const blob = doc.output('blob');
  triggerDownload(blob, filename);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
