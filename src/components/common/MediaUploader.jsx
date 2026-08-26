import { useRef, useState } from 'react';
import { AlertTriangle, Camera, ExternalLink, FileImage, FileText, FolderOpen, Maximize2, X } from 'lucide-react';
import './MediaUploader.css';

const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

function readFile(file, done, onError, maxBytes, label) {
  if (!file) return;
  if (file.size > maxBytes) {
    onError?.(`${label} is too large. Maximum allowed size is ${Math.round(maxBytes / 1024 / 1024)} MB.`);
    return;
  }
  const reader = new FileReader();
  reader.onerror = () => onError?.(`Could not read the selected ${label.toLowerCase()}. Please try another file.`);
  reader.onload = () => done({ name: file.name, type: file.type, size: file.size, data: reader.result });
  reader.readAsDataURL(file);
}

export default function MediaUploader({
  title,
  photo,
  document,
  onPhotoChange,
  onDocumentChange,
}) {
  const photoCameraRef = useRef(null);
  const documentCameraRef = useRef(null);
  const photoFileRef = useRef(null);
  const documentRef = useRef(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [mediaError, setMediaError] = useState('');

  const pickPhoto = (event) => {
    setMediaError('');
    readFile(
      event.target.files?.[0],
      (file) => onPhotoChange?.(file.data),
      setMediaError,
      MAX_PHOTO_BYTES,
      `${title} photo`,
    );
    event.target.value = '';
  };

  const pickDocument = (event) => {
    setMediaError('');
    readFile(
      event.target.files?.[0],
      (file) => onDocumentChange?.(file),
      setMediaError,
      MAX_DOCUMENT_BYTES,
      `${title} document`,
    );
    event.target.value = '';
  };

  const openDocument = () => {
    if (!document?.data) return;
    const popup = window.open();
    if (popup) popup.location.href = document.data;
  };

  return (
    <div className="media-uploader">
      {mediaError && <div className="media-upload-error"><AlertTriangle size={15}/><span>{mediaError}</span></div>}

      <div className="profile-media-card">
        <button type="button" className={`profile-photo ${photo ? 'has-photo' : ''}`} onClick={() => photo && setViewerOpen(true)} title={photo ? `View ${title} photo` : `${title} photo`}>
          {photo ? <img src={photo} alt={`${title} profile`} /> : <Camera size={25} />}
          {photo && <span className="photo-expand"><Maximize2 size={13}/></span>}
        </button>
        <div className="profile-media-copy">
          <strong>{title} Photo</strong>
          <p>The selected photo becomes the profile photo. Camera and gallery images up to 12 MB are supported.</p>
          <div className="media-actions">
            <button type="button" onClick={() => photoCameraRef.current?.click()}><Camera size={15}/> Camera</button>
            <button type="button" onClick={() => photoFileRef.current?.click()}><FolderOpen size={15}/> Files</button>
          </div>
        </div>
      </div>

      <div className="document-media-card">
        <span className="document-icon">{document?.type?.includes('pdf') ? <FileText size={21}/> : <FileImage size={21}/>}</span>
        <div>
          <strong>Document Photo / PDF</strong>
          <p>{document?.name || 'Add ID proof or another supporting document from camera or files. Images/PDFs up to 20 MB.'}</p>
        </div>
        <div className="media-actions document-actions">
          <button type="button" onClick={() => documentCameraRef.current?.click()}><Camera size={15}/><span>Camera</span></button>
          <button type="button" onClick={() => documentRef.current?.click()}><FolderOpen size={15}/><span>Files</span></button>
          {document?.data && <button type="button" className="media-open" onClick={openDocument}><ExternalLink size={15}/><span>Open</span></button>}
        </div>
      </div>

      <input ref={photoCameraRef} className="hidden-media-input" type="file" accept="image/*" capture="environment" onChange={pickPhoto} />
      <input ref={documentCameraRef} className="hidden-media-input" type="file" accept="image/*" capture="environment" onChange={pickDocument} />
      <input ref={photoFileRef} className="hidden-media-input" type="file" accept="image/*" onChange={pickPhoto} />
      <input ref={documentRef} className="hidden-media-input" type="file" accept="image/*,.pdf,application/pdf" onChange={pickDocument} />

      {viewerOpen && photo && <div className="media-viewer" onMouseDown={(event) => event.target === event.currentTarget && setViewerOpen(false)}>
        <button type="button" className="media-viewer-close" onClick={() => setViewerOpen(false)} title="Close"><X size={20}/></button>
        <img src={photo} alt={`${title} full size`} />
      </div>}
    </div>
  );
}
