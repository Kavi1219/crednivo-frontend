import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, FileSpreadsheet, FileText } from 'lucide-react';
import './DownloadMenu.css';

/**
 * "Download ▾" button with PDF / XLSX options — the same format used by
 * Today's Collection on the Home page. Pass async handlers for each format.
 */
export default function DownloadMenu({ onPdf, onXlsx, pdfNote = 'Professional printable report', xlsxNote = 'Excel report' }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onOutside = (event) => { if (!ref.current?.contains(event.target)) setOpen(false); };
    const onEscape = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onOutside);
    document.addEventListener('keydown', onEscape);
    return () => { document.removeEventListener('pointerdown', onOutside); document.removeEventListener('keydown', onEscape); };
  }, [open]);

  const run = async (handler) => {
    setOpen(false);
    if (!handler || busy) return;
    setBusy(true);
    try { await handler(); } finally { setBusy(false); }
  };

  return (
    <div className="download-menu" ref={ref}>
      <button type="button" className="download-menu-button" onClick={() => setOpen((value) => !value)} aria-expanded={open} disabled={busy}>
        <Download size={15} /> {busy ? 'Preparing…' : 'Download'} <ChevronDown size={13} className={open ? 'open' : ''} />
      </button>
      {open && (
        <div className="download-menu-popdown">
          <button type="button" onClick={() => run(onPdf)}>
            <FileText size={16} />
            <span><strong>PDF</strong><small>{pdfNote}</small></span>
          </button>
          <button type="button" onClick={() => run(onXlsx)}>
            <FileSpreadsheet size={16} />
            <span><strong>XLSX</strong><small>{xlsxNote}</small></span>
          </button>
        </div>
      )}
    </div>
  );
}
