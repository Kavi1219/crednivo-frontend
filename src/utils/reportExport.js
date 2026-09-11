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

const PDF_MARGIN_X = 14;
const PDF_CONTENT_TOP = 34;
const PDF_FOOTER_SPACE = 19;

// Explicit ISO A4 dimensions for Word (twips).
// 210 x 297 mm = 11906 x 16838 twips.
const DOCX_A4_WIDTH = 11906;
const DOCX_A4_HEIGHT = 16838;
const DOCX_MARGIN = 850; // ~15 mm

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
  return allSections(report).some(
    (section) => Array.isArray(section.columns) && section.columns.length > 6,
  );
}

function reportOrientation(report) {
  return String(report?.orientation || '').toLowerCase() === 'landscape'
    ? 'landscape'
    : 'portrait';
}

function pdfHeader(doc, report) {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setTextColor(12, 48, 86);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('CREDNIVO', PDF_MARGIN_X, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(92, 111, 137);
  doc.text('Finance Management Platform', PDF_MARGIN_X, 21);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(17, 111, 229);
  doc.text(
    String(report?.badge || 'BUSINESS REPORT').toUpperCase(),
    pageWidth - PDF_MARGIN_X,
    16,
    { align: 'right' },
  );

  doc.setDrawColor(222, 230, 239);
  doc.line(PDF_MARGIN_X, 27, pageWidth - PDF_MARGIN_X, 27);
}

function pdfFooter(doc, report, pageNumber, totalPages) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setDrawColor(232, 237, 244);
  doc.line(
    PDF_MARGIN_X,
    pageHeight - 13,
    pageWidth - PDF_MARGIN_X,
    pageHeight - 13,
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(125, 137, 154);
  doc.text(
    `${report?.company || 'CREDNIVO'}  •  Generated ${report?.generated || ''}`,
    PDF_MARGIN_X,
    pageHeight - 8,
  );
  doc.text(
    `Page ${pageNumber} of ${totalPages}`,
    pageWidth - PDF_MARGIN_X,
    pageHeight - 8,
    { align: 'right' },
  );
}

function pdfAddPage(doc, report) {
  doc.addPage();
  pdfHeader(doc, report);
  return PDF_CONTENT_TOP;
}

function pdfEnsureSpace(doc, report, y, neededHeight) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const usableBottom = pageHeight - PDF_FOOTER_SPACE;

  if (y + neededHeight > usableBottom) {
    return pdfAddPage(doc, report);
  }
  return y;
}

function estimateSectionStartHeight(section) {
  const heading = 7;
  const note = section?.note ? 6 : 0;

  if (Array.isArray(section?.metrics)) {
    // Small metric sections should move together instead of leaving a header
    // or only the table heading at the bottom of a page.
    if (section.metrics.length <= 8) {
      return heading + note + 8 + (section.metrics.length * 7);
    }
    return heading + note + 24;
  }

  if (Array.isArray(section?.rows) && Array.isArray(section?.columns)) {
    if (section.rows.length <= 8) {
      return heading + note + 8 + (section.rows.length * 7);
    }
    return heading + note + 24;
  }

  return heading + note + 10;
}

function pdfTableHooks(doc, report) {
  return {
    // jsPDF AutoTable uses startY only on the first table page. This top
    // margin guarantees every continuation page starts below the CREDNIVO
    // header instead of drawing through it.
    margin: {
      top: PDF_CONTENT_TOP,
      bottom: PDF_FOOTER_SPACE,
      left: PDF_MARGIN_X,
      right: PDF_MARGIN_X,
    },
    willDrawPage: (data) => {
      // Page 1 is already drawn by the report renderer. Continuation pages
      // created by AutoTable need their own header.
      if (data.pageNumber > 1) {
        pdfHeader(doc, report);
      }
    },
  };
}

export async function exportReportPdf(report) {
  // A4 portrait is the default professional report format.
  // A caller can explicitly set report.orientation = 'landscape' when needed.
  const orientation = reportOrientation(report);
  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const availableWidth = pageWidth - (PDF_MARGIN_X * 2);

  pdfHeader(doc, report);

  let y = 36;

  doc.setTextColor(15, 28, 49);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14.5);
  doc.text(report?.title || 'Report', PDF_MARGIN_X, y);
  y += 6;

  if (report?.subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(93, 110, 134);
    const subtitle = doc.splitTextToSize(
      String(report.subtitle),
      availableWidth,
    );
    doc.text(subtitle, PDF_MARGIN_X, y);
    y += (subtitle.length * 4) + 2;
  }

  const metaRows = (report?.meta || []).filter(
    (item) => item?.[1] !== undefined && item?.[1] !== '',
  );

  if (metaRows.length) {
    y = pdfEnsureSpace(doc, report, y, 14);

    autoTable(doc, {
      startY: y,
      body: metaRows.map(([label, value]) => [
        String(label),
        String(value),
      ]),
      theme: 'plain',
      ...pdfTableHooks(doc, report),
      styles: {
        font: 'helvetica',
        fontSize: 7.7,
        cellPadding: 1.4,
        textColor: [72, 88, 111],
        overflow: 'linebreak',
      },
      columnStyles: {
        0: {
          fontStyle: 'bold',
          cellWidth: 31,
          textColor: [58, 75, 99],
        },
        1: {
          textColor: [16, 29, 49],
        },
      },
      pageBreak: 'auto',
      rowPageBreak: 'avoid',
      showHead: 'never',
    });

    y = doc.lastAutoTable.finalY + 6;
  }

  allSections(report).forEach((section) => {
    // Prevent orphaned section titles and tiny table fragments.
    y = pdfEnsureSpace(
      doc,
      report,
      y,
      estimateSectionStartHeight(section),
    );

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 46, 80);
    doc.text(section.title || 'Section', PDF_MARGIN_X, y);
    y += 4.5;

    if (section.note) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(102, 116, 136);

      const noteLines = doc.splitTextToSize(
        String(section.note),
        availableWidth,
      );
      doc.text(noteLines, PDF_MARGIN_X, y + 0.5);
      y += (noteLines.length * 3.3) + 2.5;
    }

    if (Array.isArray(section.metrics)) {
      const metricRows = section.metrics.map((item) => [
        item.label,
        formatDisplayValue(item.value, item.type, true),
      ]);

      // For compact metric tables, keep the whole table with the heading when
      // there is enough room on a fresh A4 page.
      y = pdfEnsureSpace(
        doc,
        report,
        y,
        metricRows.length <= 8 ? 10 + (metricRows.length * 7) : 20,
      );

      autoTable(doc, {
        startY: y,
        head: [['Metric', 'Value']],
        body: metricRows,
        theme: 'grid',
        ...pdfTableHooks(doc, report),
        styles: {
          font: 'helvetica',
          fontSize: 7.8,
          cellPadding: 2.0,
          lineColor: [225, 231, 239],
          lineWidth: 0.15,
          overflow: 'linebreak',
          valign: 'middle',
        },
        headStyles: {
          fillColor: [15, 84, 148],
          textColor: 255,
          fontStyle: 'bold',
          minCellHeight: 7,
        },
        alternateRowStyles: {
          fillColor: [248, 250, 253],
        },
        columnStyles: {
          0: {
            fontStyle: 'bold',
            cellWidth: availableWidth * 0.62,
          },
          1: {
            halign: 'right',
            cellWidth: availableWidth * 0.38,
          },
        },
        pageBreak: metricRows.length <= 8 ? 'avoid' : 'auto',
        rowPageBreak: 'avoid',
        showHead: 'everyPage',
      });

      y = doc.lastAutoTable.finalY + 7;
    }

    if (Array.isArray(section.columns) && Array.isArray(section.rows)) {
      const head = [
        section.columns.map((column) => column.label),
      ];

      const body = section.rows.map((row) => (
        section.columns.map((column, index) => {
          const raw = Array.isArray(row)
            ? row[index]
            : row?.[column.key];

          return formatDisplayValue(raw, column.type, true);
        })
      ));

      const columnCount = section.columns.length;
      const tableFontSize = columnCount >= 8
        ? 5.6
        : columnCount === 7
          ? 6.0
          : columnCount === 6
            ? 6.5
            : 7.2;

      y = pdfEnsureSpace(
        doc,
        report,
        y,
        body.length <= 8 ? 10 + (body.length * 7) : 21,
      );

      autoTable(doc, {
        startY: y,
        head,
        body,
        theme: 'grid',
        ...pdfTableHooks(doc, report),
        styles: {
          font: 'helvetica',
          fontSize: tableFontSize,
          cellPadding: columnCount >= 7 ? 1.25 : 1.6,
          lineColor: [225, 231, 239],
          lineWidth: 0.15,
          overflow: 'linebreak',
          valign: 'middle',
        },
        headStyles: {
          fillColor: [15, 84, 148],
          textColor: 255,
          fontStyle: 'bold',
          valign: 'middle',
          minCellHeight: 7,
        },
        alternateRowStyles: {
          fillColor: [248, 250, 253],
        },
        pageBreak: body.length <= 8 ? 'avoid' : 'auto',
        rowPageBreak: 'avoid',
        showHead: 'everyPage',
      });

      y = doc.lastAutoTable.finalY + 7;
    }
  });

  const totalPages = doc.internal.getNumberOfPages();

  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    pdfFooter(doc, report, page, totalPages);
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
  const border = {
    style: BorderStyle.SINGLE,
    size: 1,
    color: 'DDE5EF',
  };

  return {
    top: border,
    bottom: border,
    left: border,
    right: border,
    insideHorizontal: border,
    insideVertical: border,
  };
}

function docxCell(
  text,
  {
    bold = false,
    header = false,
    align = AlignmentType.LEFT,
    fontSize = 18,
  } = {},
) {
  return new TableCell({
    shading: header
      ? {
          type: ShadingType.CLEAR,
          fill: '0F5494',
          color: 'auto',
        }
      : undefined,
    margins: {
      top: 80,
      bottom: 80,
      left: 100,
      right: 100,
    },
    children: [
      new Paragraph({
        alignment: align,
        spacing: {
          before: 0,
          after: 0,
          line: 240,
        },
        children: [
          new TextRun({
            text: String(text ?? ''),
            bold,
            color: header ? 'FFFFFF' : '10203A',
            size: fontSize,
            font: 'Aptos',
          }),
        ],
      }),
    ],
  });
}

function docxTableSpacing() {
  return new Paragraph({
    children: [new TextRun({ text: '' })],
    spacing: { after: 80 },
  });
}

export async function exportReportDoc(report) {
  const children = [];
  const wideReport = hasWideTable(report);

  children.push(new Paragraph({
    children: [
      new TextRun({
        text: 'CREDNIVO',
        bold: true,
        color: '0C3056',
        size: 34,
        font: 'Aptos Display',
      }),
    ],
    spacing: {
      after: 20,
    },
    keepNext: true,
  }));

  children.push(new Paragraph({
    children: [
      new TextRun({
        text: 'Finance Management Platform',
        color: '6B7D95',
        size: 17,
        font: 'Aptos',
      }),
    ],
    spacing: {
      after: 180,
    },
    keepNext: true,
  }));

  children.push(new Paragraph({
    children: [
      new TextRun({
        text: report?.title || 'Report',
        bold: true,
        color: '10203A',
        size: 30,
        font: 'Aptos Display',
      }),
    ],
    spacing: {
      after: 70,
    },
    keepNext: true,
  }));

  if (report?.subtitle) {
    children.push(new Paragraph({
      children: [
        new TextRun({
          text: String(report.subtitle),
          color: '5D6F87',
          size: 18,
          font: 'Aptos',
        }),
      ],
      spacing: {
        after: 120,
      },
      keepNext: true,
    }));
  }

  const metaRows = (report?.meta || []).filter(
    ([, value]) => value !== undefined && value !== null && value !== '',
  );

  if (metaRows.length) {
    children.push(new Table({
      width: {
        size: 100,
        type: WidthType.PERCENTAGE,
      },
      borders: {
        top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      },
      rows: metaRows.map(([label, value]) => (
        new TableRow({
          cantSplit: true,
          children: [
            docxCell(label, { bold: true, fontSize: 17 }),
            docxCell(String(value), { fontSize: 17 }),
          ],
        })
      )),
    }));

    children.push(docxTableSpacing());
  }

  allSections(report).forEach((section) => {
    // keepNext keeps the section heading attached to the following note/table,
    // preventing orphan headings at the bottom of an A4 page.
    children.push(new Paragraph({
      children: [
        new TextRun({
          text: section.title || 'Section',
          bold: true,
          color: '0F2E50',
          size: 22,
          font: 'Aptos Display',
        }),
      ],
      spacing: {
        before: 160,
        after: 70,
      },
      keepNext: true,
    }));

    if (section.note) {
      children.push(new Paragraph({
        children: [
          new TextRun({
            text: String(section.note),
            italics: true,
            color: '6B7D95',
            size: 16,
            font: 'Aptos',
          }),
        ],
        spacing: {
          after: 70,
        },
        keepNext: true,
      }));
    }

    if (Array.isArray(section.metrics)) {
      children.push(new Table({
        width: {
          size: 100,
          type: WidthType.PERCENTAGE,
        },
        borders: docxBorders(),
        rows: [
          new TableRow({
            tableHeader: true,
            cantSplit: true,
            children: [
              docxCell('Metric', {
                header: true,
                bold: true,
              }),
              docxCell('Value', {
                header: true,
                bold: true,
                align: AlignmentType.RIGHT,
              }),
            ],
          }),
          ...section.metrics.map((item) => (
            new TableRow({
              cantSplit: true,
              children: [
                docxCell(item.label, {
                  bold: true,
                }),
                docxCell(
                  formatDisplayValue(item.value, item.type),
                  {
                    align: AlignmentType.RIGHT,
                  },
                ),
              ],
            })
          )),
        ],
      }));

      children.push(docxTableSpacing());
    }

    if (
      Array.isArray(section.columns)
      && Array.isArray(section.rows)
    ) {
      const columnCount = section.columns.length;
      const tableFontSize = columnCount >= 8
        ? 14
        : columnCount >= 6
          ? 15
          : 17;

      const numericTypes = new Set([
        'currency',
        'number',
        'percent',
      ]);

      children.push(new Table({
        width: {
          size: 100,
          type: WidthType.PERCENTAGE,
        },
        borders: docxBorders(),
        rows: [
          new TableRow({
            tableHeader: true,
            cantSplit: true,
            children: section.columns.map((column) => (
              docxCell(column.label, {
                header: true,
                bold: true,
                align: numericTypes.has(column.type)
                  ? AlignmentType.RIGHT
                  : AlignmentType.LEFT,
                fontSize: tableFontSize,
              })
            )),
          }),
          ...section.rows.map((dataRow) => (
            new TableRow({
              cantSplit: true,
              children: section.columns.map((column, index) => {
                const value = Array.isArray(dataRow)
                  ? dataRow[index]
                  : dataRow?.[column.key];

                return docxCell(
                  formatDisplayValue(value, column.type),
                  {
                    align: numericTypes.has(column.type)
                      ? AlignmentType.RIGHT
                      : AlignmentType.LEFT,
                    fontSize: tableFontSize,
                  },
                );
              }),
            })
          )),
        ],
      }));

      children.push(docxTableSpacing());
    }
  });

  const orientation = reportOrientation(report);
  const isLandscape = orientation === 'landscape';

  const document = new Document({
    sections: [{
      properties: {
        page: {
          size: {
            width: isLandscape
              ? DOCX_A4_HEIGHT
              : DOCX_A4_WIDTH,
            height: isLandscape
              ? DOCX_A4_WIDTH
              : DOCX_A4_HEIGHT,
            orientation: isLandscape
              ? PageOrientation.LANDSCAPE
              : PageOrientation.PORTRAIT,
          },
          margin: {
            top: DOCX_MARGIN,
            right: DOCX_MARGIN,
            bottom: DOCX_MARGIN,
            left: DOCX_MARGIN,
            header: 425,
            footer: 425,
          },
        },
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(document);
  downloadBlob(blob, `${reportFileBase(report)}.docx`);
}

