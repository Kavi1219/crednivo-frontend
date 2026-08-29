import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Camera, FileText, Maximize2, Plus, X } from 'lucide-react';
import { getAuthToken } from '../../services/api';
import './MediaUploader.css';

const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
const MAX_DOCUMENTS = 4;

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

function isMobileLike() {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  const uaMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
  const coarse = window.matchMedia?.('(pointer: coarse)')?.matches;
  return uaMobile || (coarse && window.innerWidth <= 900);
}

async function openProtectedFile(document) {
  const source = String(document?.data || '').trim();
  if (!source) return;

  const popup = window.open('', '_blank');
  if (!popup) return;

  if (/^(data:|blob:)/i.test(source)) {
    popup.location.href = source;
    return;
  }

  try {
    const token = getAuthToken();
    const response = await fetch(source, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new Error(`Document request failed (${response.status})`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    popup.location.href = objectUrl;
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 5 * 60 * 1000);
  } catch (error) {
    console.error('CREDNIVO protected document load failed', error);
    popup.close();
    window.alert('Could not open this document. Please try again.');
  }
}

function imageLike(document) {
  return String(document?.type || '').startsWith('image/') || /^data:image\//i.test(String(document?.data || ''));
}

function ProtectedMediaImage({ src, alt = '', className = '', fallback = null }) {
  const [resolvedSrc, setResolvedSrc] = useState(() => {
    const value = String(src || '').trim();
    return /^(data:|blob:)/i.test(value) ? value : '';
  });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';
    const value = String(src || '').trim();

    setFailed(false);

    if (!value) {
      setResolvedSrc('');
      return undefined;
    }

    if (/^(data:|blob:)/i.test(value)) {
      setResolvedSrc(value);
      return undefined;
    }

    setResolvedSrc('');

    const load = async () => {
      try {
        const token = getAuthToken();
        const response = await fetch(value, {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!response.ok) throw new Error(`Media request failed (${response.status})`);

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setResolvedSrc(objectUrl);
      } catch (error) {
        console.error('CREDNIVO protected media preview failed', error);
        if (!cancelled) {
          setResolvedSrc('');
          setFailed(true);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  if (!src || failed || !resolvedSrc) return fallback;
  return <img src={resolvedSrc} alt={alt} className={className} />;
}

export default function MediaUploader({
  title,
  photo,
  document,
  documents,
  onPhotoChange,
  onDocumentChange,
  onDocumentsChange,
  maxDocuments = MAX_DOCUMENTS,
}) {
  const photoCameraRef = useRef(null);
  const documentCameraRef = useRef(null);
  const photoFileRef = useRef(null);
  const documentFileRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [cameraMode, setCameraMode] = useState(null);

  const documentList = useMemo(() => {
    if (Array.isArray(documents)) return documents.filter(Boolean).slice(0, maxDocuments);
    return document ? [document] : [];
  }, [documents, document, maxDocuments]);

  const emitDocuments = (next) => {
    const limited = next.filter(Boolean).slice(0, maxDocuments);
    if (onDocumentsChange) onDocumentsChange(limited);
    if (onDocumentChange) onDocumentChange(limited[0] || null);
  };

  const addDocument = (file) => {
    if (!file) return;
    if (documentList.length >= maxDocuments) {
      setMediaError(`You can add up to ${maxDocuments} documents.`);
      return;
    }
    emitDocuments([...documentList, file]);
  };

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

  const pickDocuments = (event) => {
    setMediaError('');
    const selected = Array.from(event.target.files || []);
    const remaining = Math.max(0, maxDocuments - documentList.length);
    selected.slice(0, remaining).forEach((file) => {
      readFile(
        file,
        addDocument,
        setMediaError,
        MAX_DOCUMENT_BYTES,
        `${title} document`,
      );
    });
    if (selected.length > remaining) {
      setMediaError(`Only ${maxDocuments} documents can be added.`);
    }
    event.target.value = '';
  };

  const pickDocumentCamera = (event) => {
    setMediaError('');
    readFile(
      event.target.files?.[0],
      addDocument,
      setMediaError,
      MAX_DOCUMENT_BYTES,
      `${title} document`,
    );
    event.target.value = '';
  };

  const stopCamera = () => {
    streamRef.current?.getTracks?.().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraMode(null);
  };

  useEffect(() => () => {
    streamRef.current?.getTracks?.().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    if (cameraMode && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play?.().catch(() => {});
    }
  }, [cameraMode]);

  const startDesktopCamera = async (mode) => {
    setMediaError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setMediaError('This browser cannot access the PC camera. Try Chrome or Edge and allow camera permission.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraMode(mode);
    } catch (error) {
      console.error('CREDNIVO camera access failed', error);
      setMediaError('Camera could not be opened. Check Windows/browser camera permission and try again.');
    }
  };

  const requestCamera = (mode) => {
    if (isMobileLike()) {
      if (mode === 'photo') photoCameraRef.current?.click();
      else documentCameraRef.current?.click();
      return;
    }
    startDesktopCamera(mode);
  };

  const captureCamera = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setMediaError('Camera is still starting. Try Capture again in a moment.');
      return;
    }

    const canvas = window.document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL('image/jpeg', 0.9);

    if (cameraMode === 'photo') {
      onPhotoChange?.(data);
    } else if (cameraMode === 'document') {
      addDocument({
        name: `${String(title || 'document').toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.jpg`,
        type: 'image/jpeg',
        size: Math.round((data.length * 3) / 4),
        data,
      });
    }
    stopCamera();
  };

  const removeDocument = (index) => {
    const target = documentList[index];
    // Existing server documents are intentionally view-only here. Deletion should
    // happen through the Documents module so live records are not removed accidentally.
    if (target?.backendId && !String(target?.data || '').startsWith('data:')) return;
    emitDocuments(documentList.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <div className="media-uploader media-uploader-compact">
      {mediaError && <div className="media-upload-error"><AlertTriangle size={15}/><span>{mediaError}</span></div>}

      <div className="compact-media-strip">
        <div className="compact-photo-wrap">
          <button
            type="button"
            className={`compact-media-tile compact-photo-tile ${photo ? 'has-photo' : ''}`}
            onClick={() => photo ? setViewerOpen(true) : requestCamera('photo')}
            title={photo ? `View ${title} photo` : `Take ${title} photo`}
          >
            {photo
              ? <ProtectedMediaImage src={photo} alt={`${title} profile`} fallback={<Camera size={27}/>} />
              : <Camera size={27}/>
            }
            {photo && <span className="compact-photo-expand"><Maximize2 size={11}/></span>}
          </button>

          <button
            type="button"
            className="compact-camera-badge"
            onClick={() => requestCamera('photo')}
            title={photo ? `Replace ${title} photo` : `Take ${title} photo`}
          >
            <Camera size={14}/>
          </button>
        </div>

        {documentList.map((item, index) => {
          const localImage = imageLike(item) && /^(data:|blob:)/i.test(String(item?.data || ''));
          const removable = !item?.backendId || String(item?.data || '').startsWith('data:');
          return <div className="compact-document-wrap" key={`${item?.backendId || item?.name || 'document'}-${index}`}>
            <button
              type="button"
              className="compact-media-tile compact-document-tile"
              onClick={() => openProtectedFile(item)}
              title={`View document ${index + 1}`}
            >
              {localImage ? <img src={item.data} alt={`Document ${index + 1}`} /> : <FileText size={24}/>} 
              <span className="compact-document-number">{index + 1}</span>
            </button>
            {removable && <button type="button" className="compact-remove" onClick={() => removeDocument(index)} title="Remove document"><X size={12}/></button>}
          </div>;
        })}

        {documentList.length < maxDocuments && <button
          type="button"
          className="compact-media-tile compact-add-tile"
          onClick={() => documentFileRef.current?.click()}
          title="Add document"
        >
          <Plus size={31}/>
        </button>}
      </div>

      <input ref={photoCameraRef} className="hidden-media-input" type="file" accept="image/*" capture="environment" onChange={pickPhoto} />
      <input ref={documentCameraRef} className="hidden-media-input" type="file" accept="image/*" capture="environment" onChange={pickDocumentCamera} />
      <input ref={photoFileRef} className="hidden-media-input" type="file" accept="image/*" onChange={pickPhoto} />
      <input ref={documentFileRef} className="hidden-media-input" type="file" accept="image/*,.pdf,application/pdf" multiple onChange={pickDocuments} />

      {viewerOpen && photo && <div className="media-viewer" onMouseDown={(event) => event.target === event.currentTarget && setViewerOpen(false)}>
        <button type="button" className="media-viewer-close" onClick={() => setViewerOpen(false)} title="Close"><X size={20}/></button>
        <ProtectedMediaImage src={photo} alt={`${title} full size`} fallback={<div className="media-viewer-loading"><Camera size={30}/><span>Loading photo...</span></div>} />
      </div>}

      {cameraMode && <div className="webcam-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && stopCamera()}>
        <div className="webcam-modal">
          <div className="webcam-modal-head">
            <div><strong>{cameraMode === 'photo' ? `${title} Photo` : `${title} Document`}</strong><span>Live PC camera</span></div>
            <button type="button" onClick={stopCamera} title="Close"><X size={19}/></button>
          </div>
          <div className="webcam-preview"><video ref={videoRef} autoPlay playsInline muted /></div>
          <div className="webcam-actions">
            <button type="button" className="webcam-cancel" onClick={stopCamera}>Cancel</button>
            <button type="button" className="webcam-capture" onClick={captureCamera}><Camera size={17}/> Capture</button>
          </div>
        </div>
      </div>}
    </div>  );
}
