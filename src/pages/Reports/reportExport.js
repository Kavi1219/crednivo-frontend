import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx-js-style';
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';

const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

const NUMBER = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

function sanitizeFileName(value) {
  return String(value || 'crednivo-report')
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'crednivo-report';
}

function formatDateText(value) {
  if (!value) return '—';
  const raw = String(value).slice(0, 10);
  const parts = raw.split('-');
  if (parts.length === 3 && parts[0].length === 4) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return String(value);
}

function formatDisplayValue(value, type, pdf = false) {
  if (value === null || value === undefined || value === '') return '—';
  if (type === 'currency') {
    if (pdf) return `INR ${NUMBER.format(Number(value) || 0)}`;
    return INR.format(Number(value) || 0);
  }
  if (type === 'number') return NUMBER.format(Number(value) || 0);
  if (type === 'percent') return `${NUMBER.format(Number(value) || 0)}%`;
  if (type === 'date') return formatDateText(value);
  return String(value);
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function reportFileBase(report) {
  return sanitizeFileName(report?.fileBase || report?.title || 'crednivo-report');
}

function allSections(report) {
  return Array.isArray(report?.sections) ? report.sections : [];
}

function hasWideTable(report) {
  return allSections(report).some((section) => Array.isArray(section.columns) && section.columns.length > 6);
}

function pdfHeader(doc, report) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setTextColor(12, 48, 86);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('CREDNIVO', 14, 17);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(92, 111, 137);
  doc.text('Finance Management Platform', 14, 22);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(17, 111, 229);
  doc.text(String(report?.badge || 'BUSINESS REPORT').toUpperCase(), pageWidth - 14, 17, { align: 'right' });

  doc.setDrawColor(222, 230, 239);
  doc.line(14, 27, pageWidth - 14, 27);
}

function pdfFooter(doc, report) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setDrawColor(232, 237, 244);
  doc.line(14, pageHeight - 13, pageWidth - 14, pageHeight - 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(125, 137, 154);
  doc.text(`${report?.company || 'CREDNIVO'}  •  Generated ${report?.generated || ''}`, 14, pageHeight - 8);
  doc.text(`Page ${doc.internal.getNumberOfPages()}`, pageWidth - 14, pageHeight - 8, { align: 'right' });
}

export async function exportReportPdf(report) {
  const landscape = hasWideTable(report);
  const doc = new jsPDF({
    orientation: landscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  pdfHeader(doc, report);

  let y = 37;
  doc.setTextColor(15, 28, 49);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(report?.title || 'Report', margin, y);
  y += 6;

  if (report?.subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(93, 110, 134);
    const subtitle = doc.splitTextToSize(String(report.subtitle), pageWidth - (margin * 2));
    doc.text(subtitle, margin, y);
    y += subtitle.length * 4 + 2;
  }

  const metaRows = (report?.meta || []).filter((item) => item?.[1] !== undefined && item?.[1] !== '');
  if (metaRows.length) {
    autoTable(doc, {
      startY: y,
      body: metaRows.map(([label, value]) => [String(label), String(value)]),
      theme: 'plain',
      margin: { left: margin, right: margin },
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.5, textColor: [72, 88, 111] },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 31, textColor: [58, 75, 99] },
        1: { textColor: [16, 29, 49] },
      },
    });
    y = doc.lastAutoTable.finalY + 5;
  }

  allSections(report).forEach((section) => {
    if (y > doc.internal.pageSize.getHeight() - 34) {
      doc.addPage();
      pdfHeader(doc, report);
      y = 36;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 46, 80);
    doc.text(section.title || 'Section', margin, y);
    y += 4;

    if (section.note) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(102, 116, 136);
      doc.text(String(section.note), margin, y + 1);
      y += 5;
    }

    if (Array.isArray(section.metrics)) {
      const metricRows = section.metrics.map((item) => [
        item.label,
        formatDisplayValue(item.value, item.type, true),
      ]);
      autoTable(doc, {
        startY: y,
        head: [['Metric', 'Value']],
        body: metricRows,
        theme: 'grid',
        margin: { left: margin, right: margin },
        styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.3, lineColor: [225, 231, 239], lineWidth: 0.15 },
        headStyles: { fillColor: [15, 84, 148], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 253] },
        columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' } },
        didDrawPage: () => pdfHeader(doc, report),
      });
      y = doc.lastAutoTable.finalY + 7;
    }

    if (Array.isArray(section.columns) && Array.isArray(section.rows)) {
      const head = [section.columns.map((column) => column.label)];
      const body = section.rows.map((row) => section.columns.map((column, index) => {
        const raw = Array.isArray(row) ? row[index] : row?.[column.key];
        return formatDisplayValue(raw, column.type, true);
      }));
      autoTable(doc, {
        startY: y,
        head,
        body,
        theme: 'grid',
        margin: { left: margin, right: margin },
        styles: { font: 'helvetica', fontSize: landscape ? 6.7 : 7.5, cellPadding: 1.8, lineColor: [225, 231, 239], lineWidth: 0.15, overflow: 'linebreak' },
        headStyles: { fillColor: [15, 84, 148], textColor: 255, fontStyle: 'bold', valign: 'middle' },
        alternateRowStyles: { fillColor: [248, 250, 253] },
        didDrawPage: () => pdfHeader(doc, report),
      });
      y = doc.lastAutoTable.finalY + 7;
    }
  });

  const pages = doc.internal.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    pdfFooter(doc, report);
  }

  doc.save(`${reportFileBase(report)}.pdf`);
}

function excelCellValue(value, type) {
  if (type === 'currency' || type === 'number' || type === 'percent') return Number(value) || 0;
  if (type === 'date') return formatDateText(value);
  return value === null || value === undefined ? '' : value;
}

function applyExcelCellStyle(cell, style = {}) {
  if (!cell) return;
  cell.s = {
    font: { name: 'Aptos', sz: 10, color: { rgb: '10203A' }, ...(style.font || {}) },
    alignment: { vertical: 'center', ...(style.alignment || {}) },
    fill: style.fill,
    border: style.border,
    numFmt: style.numFmt,
  };
}

function ensureCell(ws, row, col) {
  const ref = XLSX.utils.encode_cell({ r: row, c: col });
  if (!ws[ref]) ws[ref] = { t: 's', v: '' };
  return ws[ref];
}

export async function exportReportExcel(report) {
  const ws = {};
  const merges = [];
  let row = 0;
  const maxCols = Math.max(
    6,
    ...allSections(report).map((section) => Array.isArray(section.columns) ? section.columns.length : 2),
  );

  const set = (r, c, value, type = 'text', style = {}) => {
    const ref = XLSX.utils.encode_cell({ r, c });
    const v = excelCellValue(value, type);
    ws[ref] = {
      t: typeof v === 'number' ? 'n' : 's',
      v,
    };
    const numberFormat = type === 'currency'
      ? '₹#,##0.00;[Red]-₹#,##0.00'
      : type === 'percent'
        ? '0.00%'
        : type === 'number'
          ? '#,##0.00'
          : undefined;
    applyExcelCellStyle(ws[ref], { ...style, numFmt: style.numFmt || numberFormat });
    return ws[ref];
  };

  set(row, 0, 'CREDNIVO', 'text', { font: { bold: true, sz: 18, color: { rgb: '0C3056' } } });
  merges.push({ s: { r: row, c: 0 }, e: { r: row, c: maxCols - 1 } });
  row += 1;
  set(row, 0, 'Finance Management Platform', 'text', { font: { sz: 9, color: { rgb: '6B7D95' } } });
  merges.push({ s: { r: row, c: 0 }, e: { r: row, c: maxCols - 1 } });
  row += 2;

  set(row, 0, report?.title || 'Report', 'text', { font: { bold: true, sz: 15, color: { rgb: '10203A' } } });
  merges.push({ s: { r: row, c: 0 }, e: { r: row, c: maxCols - 1 } });
  row += 1;
  if (report?.subtitle) {
    set(row, 0, report.subtitle, 'text', { font: { sz: 9, color: { rgb: '6B7D95' } }, alignment: { wrapText: true } });
    merges.push({ s: { r: row, c: 0 }, e: { r: row, c: maxCols - 1 } });
    row += 2;
  }

  (report?.meta || []).forEach(([label, value]) => {
    set(row, 0, label, 'text', { font: { bold: true, color: { rgb: '40536D' } } });
    set(row, 1, value);
    merges.push({ s: { r: row, c: 1 }, e: { r: row, c: Math.min(maxCols - 1, 3) } });
    row += 1;
  });
  row += 1;

  allSections(report).forEach((section) => {
    set(row, 0, section.title || 'Section', 'text', {
      font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
      fill: { patternType: 'solid', fgColor: { rgb: '0F5494' } },
    });
    for (let c = 1; c < maxCols; c += 1) {
      set(row, c, '', 'text', { fill: { patternType: 'solid', fgColor: { rgb: '0F5494' } } });
    }
    merges.push({ s: { r: row, c: 0 }, e: { r: row, c: maxCols - 1 } });
    row += 1;

    if (section.note) {
      set(row, 0, section.note, 'text', { font: { italic: true, color: { rgb: '6B7D95' } } });
      merges.push({ s: { r: row, c: 0 }, e: { r: row, c: maxCols - 1 } });
      row += 1;
    }

    if (Array.isArray(section.metrics)) {
      set(row, 0, 'Metric', 'text', {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { patternType: 'solid', fgColor: { rgb: '3F6F9F' } },
      });
      set(row, 1, 'Value', 'text', {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { patternType: 'solid', fgColor: { rgb: '3F6F9F' } },
      });
      row += 1;
      section.metrics.forEach((item, index) => {
        const fill = index % 2 === 0 ? 'F8FAFD' : 'FFFFFF';
        set(row, 0, item.label, 'text', { font: { bold: true }, fill: { patternType: 'solid', fgColor: { rgb: fill } } });
        set(row, 1, item.value, item.type, { fill: { patternType: 'solid', fgColor: { rgb: fill } } });
        row += 1;
      });
    }

    if (Array.isArray(section.columns) && Array.isArray(section.rows)) {
      section.columns.forEach((column, c) => {
        set(row, c, column.label, 'text', {
          font: { bold: true, color: { rgb: 'FFFFFF' } },
          fill: { patternType: 'solid', fgColor: { rgb: '3F6F9F' } },
          alignment: { wrapText: true },
        });
      });
      row += 1;

      section.rows.forEach((dataRow, rowIndex) => {
        const fill = rowIndex % 2 === 0 ? 'F8FAFD' : 'FFFFFF';
        section.columns.forEach((column, c) => {
          const value = Array.isArray(dataRow) ? dataRow[c] : dataRow?.[column.key];
          set(row, c, value, column.type, {
            fill: { patternType: 'solid', fgColor: { rgb: fill } },
            alignment: { wrapText: true },
          });
        });
        row += 1;
      });
    }
    row += 2;
  });

  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, row - 1), c: maxCols - 1 } });
  ws['!merges'] = merges;
  ws['!cols'] = Array.from({ length: maxCols }, (_, index) => ({ wch: index === 0 ? 25 : 18 }));
  ws['!rows'] = Array.from({ length: row }, () => ({ hpt: 20 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  XLSX.writeFile(wb, `${reportFileBase(report)}.xlsx`, { compression: true });
}

function docxBorders() {
  const border = { style: BorderStyle.SINGLE, size: 1, color: 'DDE5EF' };
  return { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };
}

function docxCell(text, { bold = false, header = false, align = AlignmentType.LEFT } = {}) {
  return new TableCell({
    shading: header ? { type: ShadingType.CLEAR, fill: '0F5494', color: 'auto' } : undefined,
    children: [new Paragraph({
      alignment: align,
      children: [new TextRun({
        text: String(text ?? ''),
        bold,
        color: header ? 'FFFFFF' : '10203A',
        size: header ? 18 : 18,
      })],
    })],
  });
}

export async function exportReportDoc(report) {
  const children = [];
  children.push(new Paragraph({
    children: [new TextRun({ text: 'CREDNIVO', bold: true, color: '0C3056', size: 34 })],
    spacing: { after: 40 },
  }));
  children.push(new Paragraph({
    children: [new TextRun({ text: 'Finance Management Platform', color: '6B7D95', size: 17 })],
    spacing: { after: 220 },
  }));
  children.push(new Paragraph({
    text: report?.title || 'Report',
    heading: HeadingLevel.TITLE,
    spacing: { after: 80 },
  }));
  if (report?.subtitle) {
    children.push(new Paragraph({
      children: [new TextRun({ text: String(report.subtitle), color: '5D6F87', size: 19 })],
      spacing: { after: 160 },
    }));
  }

  (report?.meta || []).forEach(([label, value]) => {
    children.push(new Paragraph({
      children: [
        new TextRun({ text: `${label}: `, bold: true, color: '40536D', size: 18 }),
        new TextRun({ text: String(value ?? ''), color: '10203A', size: 18 }),
      ],
      spacing: { after: 36 },
    }));
  });

  allSections(report).forEach((section) => {
    children.push(new Paragraph({
      text: section.title || 'Section',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 220, after: 80 },
    }));
    if (section.note) {
      children.push(new Paragraph({
        children: [new TextRun({ text: String(section.note), italics: true, color: '6B7D95', size: 17 })],
        spacing: { after: 80 },
      }));
    }

    if (Array.isArray(section.metrics)) {
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: docxBorders(),
        rows: [
          new TableRow({ children: [docxCell('Metric', { header: true, bold: true }), docxCell('Value', { header: true, bold: true })] }),
          ...section.metrics.map((item) => new TableRow({
            children: [
              docxCell(item.label, { bold: true }),
              docxCell(formatDisplayValue(item.value, item.type)),
            ],
          })),
        ],
      }));
    }

    if (Array.isArray(section.columns) && Array.isArray(section.rows)) {
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: docxBorders(),
        rows: [
          new TableRow({ children: section.columns.map((column) => docxCell(column.label, { header: true, bold: true })) }),
          ...section.rows.map((dataRow) => new TableRow({
            children: section.columns.map((column, index) => {
              const value = Array.isArray(dataRow) ? dataRow[index] : dataRow?.[column.key];
              return docxCell(formatDisplayValue(value, column.type));
            }),
          })),
        ],
      }));
    }
  });

  const document = new Document({
    sections: [{
      properties: {
        page: hasWideTable(report)
          ? { size: { orientation: PageOrientation.LANDSCAPE } }
          : undefined,
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(document);
  downloadBlob(blob, `${reportFileBase(report)}.docx`);
}
