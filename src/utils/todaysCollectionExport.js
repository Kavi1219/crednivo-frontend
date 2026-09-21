import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx-js-style';
import { getCrednivoLogoDataUrl } from './reportBrand';

const CYCLES = ['Daily', 'Weekly', 'Monthly'];
const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

function safeText(value, fallback = '—') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function formatDate(value) {
  const [y, m, d] = String(value || '').slice(0, 10).split('-');
  return y && m && d ? `${d}-${m}-${y}` : safeText(value);
}

function amountFor(row) {
  return Math.max(0, Number(row?.dueAmount || 0) - Number(row?.paidAmount || 0));
}

function fileBase(date) {
  return `crednivo-todays-collection-${String(date || '').replaceAll('/', '-')}`;
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

async function urlToPngDataUrl(url) {
  if (!url) return '';
  try {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    const loaded = new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
    });
    image.src = url;
    await loaded;
    const maxSide = 600;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
    canvas.height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } catch {
    return '';
  }
}

function rowsByCycle(cycleRows) {
  return Object.fromEntries(CYCLES.map((cycle) => [cycle, Array.isArray(cycleRows?.[cycle]) ? cycleRows[cycle] : []]));
}

function totalExpected(cycleRows) {
  return CYCLES.reduce((total, cycle) => total + (cycleRows[cycle] || []).reduce((sum, row) => sum + amountFor(row), 0), 0);
}

function customerPhone(row, phoneById) {
  return safeText(phoneById?.[String(row?.customerId)], '—');
}

export async function exportTodayCollectionPdf({
  date,
  createdBy,
  company,
  cycleRows,
  phoneById,
}) {
  const grouped = rowsByCycle(cycleRows);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  const [companyLogo, crednivoLogo] = await Promise.all([
    urlToPngDataUrl(company?.logo),
    getCrednivoLogoDataUrl().catch(() => ''),
  ]);

  const drawCompanyHeader = () => {
    let textX = margin;
    if (companyLogo) {
      try {
        doc.addImage(companyLogo, 'PNG', margin, 10, 17, 17, undefined, 'FAST');
        textX = margin + 21;
      } catch { /* logo is optional */ }
    }

    doc.setTextColor(15, 32, 58);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(safeText(company?.name, 'Company'), textX, 16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(94, 111, 135);
    doc.text(safeText(company?.branch, 'Main Branch'), textX, 22);

    doc.setDrawColor(221, 229, 239);
    doc.line(margin, 31, pageWidth - margin, 31);
  };

  const drawCrednivoFooter = (pageNo, totalPages) => {
    const y = pageHeight - 14;
    doc.setDrawColor(231, 236, 243);
    doc.line(margin, y - 7, pageWidth - margin, y - 7);

    const logoX = pageWidth - margin - 48;
    if (crednivoLogo) {
      try { doc.addImage(crednivoLogo, 'PNG', logoX, y - 4.5, 8, 7.5, undefined, 'FAST'); } catch { /* optional */ }
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(12, 48, 86);
    doc.text('CREDNIVO', logoX + 10, y - 1);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(105, 120, 141);
    doc.text('Finance Management Platform', logoX + 10, y + 3);
    doc.text(`Page ${pageNo} of ${totalPages}`, margin, y + 2);
  };

  drawCompanyHeader();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(10, 27, 48);
  doc.text("Today's Collection", margin, 42);

  autoTable(doc, {
    startY: 47,
    body: [
      ['DATE', formatDate(date)],
      ['Created by', safeText(createdBy, 'Admin')],
    ],
    theme: 'plain',
    margin: { left: margin, right: margin },
    styles: { fontSize: 8.3, cellPadding: 1.3, textColor: [48, 65, 88] },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 28, textColor: [65, 82, 105] },
      1: { textColor: [15, 31, 52] },
    },
  });

  const tableBody = [];
  CYCLES.forEach((cycle) => {
    const rows = grouped[cycle] || [];
    tableBody.push([{ content: cycle, colSpan: 5, styles: { fontStyle: 'bold', fillColor: [235, 242, 252], textColor: [14, 86, 170] } }]);

    if (rows.length === 0) {
      tableBody.push([
        '',
        { content: `No ${cycle.toLowerCase()} customers due today.`, colSpan: 3, styles: { fontStyle: 'italic', textColor: [105, 120, 141] } },
        '',
      ]);
    } else {
      rows.forEach((row) => {
        tableBody.push([
          safeText(row.customerId),
          safeText(row.customerName),
          customerPhone(row, phoneById),
          amountFor(row),
          safeText(row.status, 'Due Today'),
        ]);
      });
    }

    const subtotal = rows.reduce((sum, row) => sum + amountFor(row), 0);
    tableBody.push([
      { content: `${cycle} Total`, colSpan: 3, styles: { fontStyle: 'bold', halign: 'right', fillColor: [248, 250, 253] } },
      { content: `INR ${new Intl.NumberFormat('en-IN').format(subtotal)}`, styles: { fontStyle: 'bold', fillColor: [248, 250, 253] } },
      { content: '', styles: { fillColor: [248, 250, 253] } },
    ]);
  });

  tableBody.push([
    { content: 'Total Expected Today', colSpan: 3, styles: { fontStyle: 'bold', halign: 'right', fillColor: [223, 239, 255], textColor: [12, 77, 145] } },
    { content: `INR ${new Intl.NumberFormat('en-IN').format(totalExpected(grouped))}`, styles: { fontStyle: 'bold', fillColor: [223, 239, 255], textColor: [12, 77, 145] } },
    { content: '', styles: { fillColor: [223, 239, 255] } },
  ]);

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 5,
    head: [['Customer ID', 'Customer Name', 'Phone Number', 'Amount to Collect', 'Status']],
    body: tableBody,
    margin: { top: 36, bottom: 27, left: margin, right: margin },
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 2.1,
      lineColor: [224, 231, 240],
      lineWidth: 0.18,
      textColor: [22, 37, 58],
      valign: 'middle',
    },
    headStyles: {
      fillColor: [15, 84, 148],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.3,
    },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 46 },
      2: { cellWidth: 34 },
      3: { cellWidth: 35, halign: 'right' },
      4: { cellWidth: 31 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 3 && typeof data.cell.raw === 'number') {
        data.cell.text = [`INR ${new Intl.NumberFormat('en-IN').format(data.cell.raw)}`];
      }
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) drawCompanyHeader();
    },
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    drawCrednivoFooter(page, pages);
  }

  doc.save(`${fileBase(date)}.pdf`);
}

function excelDownloadFileName(date) {
  return `${fileBase(date)}.xlsx`;
}

function setCell(ws, row, col, value, style = {}, type = 's') {
  const ref = XLSX.utils.encode_cell({ r: row, c: col });
  ws[ref] = { t: type, v: value, s: style };
  return ws[ref];
}

export async function exportTodayCollectionXlsx({
  date,
  createdBy,
  company,
  cycleRows,
  phoneById,
}) {
  const grouped = rowsByCycle(cycleRows);
  const ws = {};
  const merges = [];
  let row = 0;
  const border = {
    top: { style: 'thin', color: { rgb: 'DDE5EF' } },
    left: { style: 'thin', color: { rgb: 'DDE5EF' } },
    bottom: { style: 'thin', color: { rgb: 'DDE5EF' } },
    right: { style: 'thin', color: { rgb: 'DDE5EF' } },
  };

  // Company identity block. Modern Excel versions render IMAGE() directly in-cell;
  // older versions still keep the company name/branch alongside it.
  if (company?.logo) {
    const logoRef = XLSX.utils.encode_cell({ r: row, c: 0 });
    ws[logoRef] = {
      t: 's',
      v: 'Company Logo',
      f: `IMAGE("${String(company.logo).replaceAll('"', '""')}","Company Logo",0)`,
      s: { alignment: { vertical: 'center', horizontal: 'center' } },
    };
    merges.push({ s: { r: row, c: 0 }, e: { r: row + 2, c: 0 } });
  }

  setCell(ws, row, 1, safeText(company?.name, 'Company'), {
    font: { bold: true, sz: 18, color: { rgb: '0F203A' } },
    alignment: { vertical: 'center' },
  });
  merges.push({ s: { r: row, c: 1 }, e: { r: row + 1, c: 4 } });
  row += 2;
  setCell(ws, row, 1, safeText(company?.branch, 'Main Branch'), {
    font: { sz: 10, color: { rgb: '64748B' } },
  });
  merges.push({ s: { r: row, c: 1 }, e: { r: row, c: 4 } });
  row += 2;

  setCell(ws, row, 0, 'DATE', { font: { bold: true, color: { rgb: '40536D' } } });
  setCell(ws, row, 1, formatDate(date));
  row += 1;
  setCell(ws, row, 0, 'Created by', { font: { bold: true, color: { rgb: '40536D' } } });
  setCell(ws, row, 1, safeText(createdBy, 'Admin'));
  row += 2;

  const headers = ['Customer ID', 'Customer Name', 'Phone Number', 'Amount to Collect', 'Status'];
  headers.forEach((header, c) => setCell(ws, row, c, header, {
    font: { bold: true, color: { rgb: 'FFFFFF' } },
    fill: { patternType: 'solid', fgColor: { rgb: '0F5494' } },
    border,
    alignment: { vertical: 'center', wrapText: true },
  }));
  const headerRow = row;
  row += 1;

  CYCLES.forEach((cycle) => {
    for (let c = 0; c < 5; c += 1) {
      setCell(ws, row, c, c === 0 ? cycle : '', {
        font: { bold: true, color: { rgb: '0E56AA' } },
        fill: { patternType: 'solid', fgColor: { rgb: 'EBF2FC' } },
        border,
      });
    }
    merges.push({ s: { r: row, c: 0 }, e: { r: row, c: 4 } });
    row += 1;

    const rows = grouped[cycle] || [];
    if (rows.length === 0) {
      setCell(ws, row, 0, '');
      setCell(ws, row, 1, `No ${cycle.toLowerCase()} customers due today.`, {
        font: { italic: true, color: { rgb: '6B7D95' } }, border,
      });
      for (let c = 0; c < 5; c += 1) {
        const ref = XLSX.utils.encode_cell({ r: row, c });
        ws[ref] = ws[ref] || { t: 's', v: '' };
        ws[ref].s = { ...(ws[ref].s || {}), border };
      }
      merges.push({ s: { r: row, c: 1 }, e: { r: row, c: 4 } });
      row += 1;
    } else {
      rows.forEach((dataRow, index) => {
        const fill = index % 2 === 0 ? 'F8FAFD' : 'FFFFFF';
        const vals = [
          safeText(dataRow.customerId),
          safeText(dataRow.customerName),
          customerPhone(dataRow, phoneById),
          amountFor(dataRow),
          safeText(dataRow.status, 'Due Today'),
        ];
        vals.forEach((value, c) => {
          const currency = c === 3;
          setCell(ws, row, c, value, {
            fill: { patternType: 'solid', fgColor: { rgb: fill } },
            border,
            alignment: { vertical: 'center', wrapText: true },
            ...(currency ? { numFmt: '₹#,##0' } : {}),
          }, currency ? 'n' : 's');
        });
        row += 1;
      });
    }

    const subtotal = rows.reduce((sum, dataRow) => sum + amountFor(dataRow), 0);
    setCell(ws, row, 0, `${cycle} Total`, {
      font: { bold: true }, fill: { patternType: 'solid', fgColor: { rgb: 'F8FAFD' } }, border,
      alignment: { horizontal: 'right' },
    });
    merges.push({ s: { r: row, c: 0 }, e: { r: row, c: 2 } });
    setCell(ws, row, 3, subtotal, {
      font: { bold: true }, fill: { patternType: 'solid', fgColor: { rgb: 'F8FAFD' } }, border,
      numFmt: '₹#,##0',
    }, 'n');
    setCell(ws, row, 4, '', { fill: { patternType: 'solid', fgColor: { rgb: 'F8FAFD' } }, border });
    row += 1;
  });

  setCell(ws, row, 0, 'Total Expected Today', {
    font: { bold: true, color: { rgb: '0C4D91' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'DDEFFF' } }, border,
    alignment: { horizontal: 'right' },
  });
  merges.push({ s: { r: row, c: 0 }, e: { r: row, c: 2 } });
  setCell(ws, row, 3, totalExpected(grouped), {
    font: { bold: true, color: { rgb: '0C4D91' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'DDEFFF' } }, border,
    numFmt: '₹#,##0',
  }, 'n');
  setCell(ws, row, 4, '', { fill: { patternType: 'solid', fgColor: { rgb: 'DDEFFF' } }, border });
  row += 3;

  setCell(ws, row, 3, 'CREDNIVO', { font: { bold: true, sz: 13, color: { rgb: '0C3056' } } });
  merges.push({ s: { r: row, c: 3 }, e: { r: row, c: 4 } });
  row += 1;
  setCell(ws, row, 3, 'Finance Management Platform', { font: { sz: 9, color: { rgb: '6B7D95' } } });
  merges.push({ s: { r: row, c: 3 }, e: { r: row, c: 4 } });

  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row, c: 4 } });
  ws['!merges'] = merges;
  ws['!cols'] = [{ wch: 18 }, { wch: 30 }, { wch: 20 }, { wch: 22 }, { wch: 18 }];
  ws['!rows'] = Array.from({ length: row + 1 }, (_, index) => ({ hpt: index === headerRow ? 25 : 21 }));
  ws['!freeze'] = { xSplit: 0, ySplit: headerRow + 1 };

  const wb = XLSX.utils.book_new();
  wb.Props = { Title: "Today's Collection", Author: 'CREDNIVO' };
  XLSX.utils.book_append_sheet(wb, ws, "Today's Collection");
  XLSX.writeFile(wb, excelDownloadFileName(date), { compression: true });
}

export { INR };
