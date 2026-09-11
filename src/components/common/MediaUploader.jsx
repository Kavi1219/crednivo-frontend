import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Camera, FileText, FolderOpen, Maximize2, Plus, X } from 'lucide-react';
import { getAuthToken } from '../../services/api';
import './MediaUploader.css';

const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
const MAX_DOCUMENTS = 4;
const DOCUMENT_ACCEPT = 'image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf';

function supportedDocumentFile(file) {
  if (!file) return false;
  const type = String(file.type || '').toLowerCase();
  const name = String(file.name || '').toLowerCase();
  return type === 'image/jpeg'
    || type === 'image/png'
    || type === 'application/pdf'
    || /\.(jpe?g|png|pdf)$/i.test(name);
}


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

function detectBrowser() {
  if (typeof navigator === 'undefined') return 'Browser';
  const ua = navigator.userAgent || '';
  if (/Edg\//i.test(ua)) return 'Microsoft Edge';
  if (/Firefox\//i.test(ua)) return 'Firefox';
  if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) return 'Google Chrome';
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua) && !/Chromium\//i.test(ua)) return 'Safari';
  return 'Browser';
}

async function getCameraPermissionState() {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) return 'unknown';
  try {
    const status = await navigator.permissions.query({ name: 'camera' });
    return status?.state || 'unknown';
  } catch {
    // Firefox/Safari versions that do not expose camera through the Permissions API
    // still show the native permission prompt when getUserMedia() is requested.
    return 'unknown';
  }
}

function cameraPermissionInstruction(browser) {
  if (browser === 'Google Chrome') {
    return 'Click the site controls icon beside the address bar → Camera → Allow. If Camera is not listed, open Site settings and set Camera to Allow.';
  }
  if (browser === 'Microsoft Edge') {
    return 'Click the site information/lock icon beside the address bar → Permissions for this site → Camera → Allow.';
  }
  if (browser === 'Firefox') {
    return 'Click the permissions/camera icon beside the address bar, clear the blocked Camera permission, then choose Allow when Firefox asks again.';
  }
  if (browser === 'Safari') {
    return 'Open Safari → Settings for This Website → Camera → Allow, then return to CREDNIVO.';
  }
  return 'Open this site’s browser permissions, set Camera to Allow, then return to CREDNIVO.';
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
  initialPickerMode = null,
  maxDocuments = MAX_DOCUMENTS,
  mode = 'both',
}) {
  const photoCameraRef = useRef(null);
  const documentCameraRef = useRef(null);
  const photoFileRef = useRef(null);
  const documentFileRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const errorRef = useRef(null);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [cameraMode, setCameraMode] = useState(null);
  const [cameraOpening, setCameraOpening] = useState(false);
  const [sourceChooser, setSourceChooser] = useState(initialPickerMode);
  const [permissionHelp, setPermissionHelp] = useState(null);

  const showPhoto = mode !== 'document';
  const showDocuments = mode !== 'photo';

  const documentList = useMemo(() => {
    if (Array.isArray(documents)) return documents.filter(Boolean).slice(0, maxDocuments);
    return document ? [document] : [];
  }, [documents, document, maxDocuments]);

  useEffect(() => {
    if (initialPickerMode === 'photo' || initialPickerMode === 'document') {
      setSourceChooser(initialPickerMode);
    }
  }, [initialPickerMode]);

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
    const accepted = selected.filter(supportedDocumentFile);
    if (accepted.length !== selected.length) {
      setMediaError('Documents must be JPG, JPEG, PNG or PDF files.');
    }
    accepted.slice(0, remaining).forEach((file) => {
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
    const file = event.target.files?.[0];
    if (file && !supportedDocumentFile(file)) {
      setMediaError('Documents must be JPG, JPEG, PNG or PDF files.');
      event.target.value = '';
      return;
    }
    readFile(
      file,
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
    setCameraOpening(false);
    setCameraMode(null);
  };

  useEffect(() => () => {
    streamRef.current?.getTracks?.().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    if (!mediaError) return undefined;

    const dismissOnOutsideClick = (event) => {
      if (errorRef.current && !errorRef.current.contains(event.target)) {
        setMediaError('');
      }
    };

    const browserDocument = typeof window !== 'undefined' ? window.document : null;
    if (!browserDocument) return undefined;

    browserDocument.addEventListener('mousedown', dismissOnOutsideClick);
    browserDocument.addEventListener('touchstart', dismissOnOutsideClick, { passive: true });

    return () => {
      browserDocument.removeEventListener('mousedown', dismissOnOutsideClick);
      browserDocument.removeEventListener('touchstart', dismissOnOutsideClick);
    };
  }, [mediaError]);

  useEffect(() => {
    if (!cameraMode) return undefined;

    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return undefined;

    try {
      video.srcObject = stream;

      // autoPlay normally starts the preview. Some browsers return undefined
      // from play(), so never call .catch directly on an unknown value.
      const playPromise = typeof video.play === 'function' ? video.play() : null;
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((error) => {
          // A blocked autoplay must not crash the whole Customer Details page.
          console.warn('CREDNIVO camera preview autoplay was blocked', error);
        });
      }
    } catch (error) {
      console.error('CREDNIVO camera preview setup failed', error);
      stream.getTracks?.().forEach((track) => track.stop());
      streamRef.current = null;
      try { video.srcObject = null; } catch {}
      setCameraMode(null);
      setMediaError('Camera preview could not be started. Please retry or choose a photo from files.');
    }

    return undefined;
  }, [cameraMode]);

  const startCamera = async (mode) => {
    setMediaError('');
    setCameraOpening(true);

    const browser = detectBrowser();

    try {
      const hostname = typeof window !== 'undefined' ? window.location?.hostname : '';
      const localDev = hostname === 'localhost' || hostname === '127.0.0.1';
      if (typeof window !== 'undefined' && !window.isSecureContext && !localDev) {
        setCameraOpening(false);
        setPermissionHelp({ mode, browser, reason: 'secure-context' });
        return;
      }

      const mediaDevices = typeof navigator !== 'undefined' ? navigator.mediaDevices : null;
      const getUserMedia = mediaDevices && typeof mediaDevices.getUserMedia === 'function'
        ? mediaDevices.getUserMedia.bind(mediaDevices)
        : null;

      if (!getUserMedia) {
        setCameraOpening(false);
        if (mode === 'photo') photoCameraRef.current?.click();
        else documentCameraRef.current?.click();
        return;
      }

      // When permission is still "prompt", calling getUserMedia from this user click
      // makes Chrome/Edge/Firefox/Safari show their native Allow/Block UI.
      // If the user previously selected Block, browsers intentionally prevent a site
      // from forcing that permission panel open again.
      const permissionState = await getCameraPermissionState();
      if (permissionState === 'denied') {
        setCameraOpening(false);
        setPermissionHelp({ mode, browser, reason: 'denied' });
        return;
      }

      const stream = await getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: isMobileLike() ? { ideal: 'environment' } : undefined,
        },
        audio: false,
      });

      if (!stream || typeof stream.getTracks !== 'function' || stream.getVideoTracks?.().length === 0) {
        throw new Error('Camera returned an invalid media stream');
      }

      streamRef.current?.getTracks?.().forEach((track) => track.stop());
      streamRef.current = stream;
      setPermissionHelp(null);
      setCameraMode(mode);
      setCameraOpening(false);
    } catch (error) {
      console.error('CREDNIVO camera access failed', error);
      streamRef.current?.getTracks?.().forEach((track) => track.stop());
      streamRef.current = null;
      setCameraMode(null);
      setCameraOpening(false);

      const denied = error?.name === 'NotAllowedError'
        || error?.name === 'PermissionDeniedError'
        || error?.name === 'SecurityError';
      const unavailable = error?.name === 'NotFoundError'
        || error?.name === 'DevicesNotFoundError'
        || error?.name === 'NotReadableError';

      if (denied) {
        const permissionState = await getCameraPermissionState();
        setPermissionHelp({
          mode,
          browser,
          reason: permissionState === 'denied' ? 'denied' : 'permission-failed',
        });
        return;
      }

      setMediaError(
        unavailable
          ? 'No usable camera was found. Check that another app is not using the camera, or choose a photo from files.'
          : 'Camera could not be opened. Check the device camera and browser permission, then try again.',
      );
    }
  };

  const openFilePicker = (mode) => {
    setSourceChooser(null);
    if (mode === 'photo') photoFileRef.current?.click();
    else documentFileRef.current?.click();
  };

  const requestCamera = (mode) => {
    if (cameraOpening) return;
    setSourceChooser(null);
    startCamera(mode);
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
    if (!context) {
      setMediaError('Camera capture is not supported by this browser.');
      return;
    }
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
    // Existing server documents are intentionally view-only here so live records
    // are not removed accidentally from the customer media editor.
    if (target?.backendId && !String(target?.data || '').startsWith('data:')) return;
    emitDocuments(documentList.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <div className="media-uploader media-uploader-compact">
      {cameraOpening && <div className="media-camera-opening"><Camera size={15}/><span>Opening camera...</span></div>}
      {mediaError && <div ref={errorRef} className="media-upload-error"><AlertTriangle size={15}/><span>{mediaError}</span></div>}

      <div className={`media-uploader-sections ${showPhoto && showDocuments ? 'two-section' : 'single-section'}`}>
        {showPhoto && <section className="media-uploader-section media-photo-section">
          <div className="media-uploader-section-head">
            <div><strong>Profile Photo</strong><span>Customer/Jamin profile image</span></div>
          </div>
          <div className="media-uploader-section-body">
            <div className="compact-photo-wrap">
              <button
                type="button"
                className={`compact-media-tile compact-photo-tile ${photo ? 'has-photo' : ''}`}
                onClick={() => photo ? setViewerOpen(true) : setSourceChooser('photo')}
                disabled={cameraOpening}
                aria-busy={cameraOpening}
                title={photo ? `View ${title} photo` : (cameraOpening ? 'Opening camera...' : `Add ${title} profile photo`)}
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
                disabled={cameraOpening}
                aria-busy={cameraOpening}
                title={cameraOpening ? 'Opening camera...' : (photo ? `Replace ${title} photo` : `Take ${title} photo`)}
              >
                <Camera size={14}/>
              </button>
            </div>
            <button type="button" className="media-separate-action" onClick={() => setSourceChooser('photo')} disabled={cameraOpening}>
              <Camera size={16}/><span>{photo ? 'Change Profile Photo' : 'Upload Profile Photo'}</span>
            </button>
          </div>
        </section>}

        {showDocuments && <section className="media-uploader-section media-document-section">
          <div className="media-uploader-section-head">
            <div><strong>Documents</strong><span>JPG, PNG or PDF only</span></div>
            <small>{documentList.length}/{maxDocuments}</small>
          </div>
          <div className="compact-media-strip compact-document-strip">
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
              onClick={() => setSourceChooser('document')}
              title="Add document"
            >
              <Plus size={31}/>
            </button>}
          </div>
          <button type="button" className="media-separate-action" onClick={() => setSourceChooser('document')} disabled={documentList.length >= maxDocuments}>
            <FileText size={16}/><span>Upload Document</span>
          </button>
        </section>}
      </div>

      <input ref={photoCameraRef} className="hidden-media-input" type="file" accept="image/*" capture="environment" onChange={pickPhoto} />
      <input ref={documentCameraRef} className="hidden-media-input" type="file" accept="image/jpeg,image/png" capture="environment" onChange={pickDocumentCamera} />
      <input ref={photoFileRef} className="hidden-media-input" type="file" accept="image/*" onChange={pickPhoto} />
      <input ref={documentFileRef} className="hidden-media-input" type="file" accept={DOCUMENT_ACCEPT} multiple onChange={pickDocuments} />

      {sourceChooser && <div className="media-source-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setSourceChooser(null)}>
        <div className="media-source-modal" role="dialog" aria-modal="true" aria-label={sourceChooser === 'photo' ? 'Add profile photo' : 'Add document'}>
          <div className="media-source-head">
            <div>
              <strong>{sourceChooser === 'photo' ? '+ Add Profile' : '+ Document'}</strong>
              <span>{sourceChooser === 'photo' ? 'Choose how to add the profile photo' : 'Choose how to add the document'}</span>
            </div>
            <button type="button" onClick={() => setSourceChooser(null)} title="Close"><X size={18}/></button>
          </div>
          <div className="media-source-actions">
            <button type="button" className="media-source-option" onClick={() => requestCamera(sourceChooser)} disabled={cameraOpening}>
              <span className="media-source-icon"><Camera size={24}/></span>
              <span><strong>Camera</strong><small>{sourceChooser === 'photo' ? 'Take profile photo from website camera' : 'Scan document using website camera'}</small></span>
            </button>
            <button type="button" className="media-source-option" onClick={() => openFilePicker(sourceChooser)}>
              <span className="media-source-icon"><FolderOpen size={24}/></span>
              <span><strong>Open Files</strong><small>{sourceChooser === 'photo' ? 'Choose JPG, PNG, WebP or another image' : 'Choose a document from this device'}</small></span>
            </button>
          </div>
          <p className="media-source-note">{sourceChooser === 'photo' ? 'Camera captures are saved as JPG.' : 'Camera scans are saved as JPG. File upload supports normal document formats.'}</p>
        </div>
      </div>}

      {permissionHelp && <div className="camera-permission-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setPermissionHelp(null)}>
        <div className="camera-permission-modal" role="dialog" aria-modal="true" aria-label="Camera permission required">
          <div className="camera-permission-head">
            <div className="camera-permission-icon"><Camera size={24}/></div>
            <div>
              <strong>Allow camera in {permissionHelp.browser}</strong>
              <span>CREDNIVO needs camera permission only when you choose Camera.</span>
            </div>
            <button type="button" onClick={() => setPermissionHelp(null)} title="Close"><X size={18}/></button>
          </div>
          <div className="camera-permission-body">
            {permissionHelp.reason === 'secure-context'
              ? <p>Browser camera access only works on a secure HTTPS website (or localhost). Open the HTTPS version of CREDNIVO and try again.</p>
              : <>
                <p>
                  {permissionHelp.reason === 'denied'
                    ? 'Camera was already blocked for this website, so the browser will not show the Allow popup again automatically.'
                    : 'The browser did not grant camera access. Check the site camera permission, then retry.'}
                </p>
                <div className="camera-permission-step">
                  <strong>{permissionHelp.browser}</strong>
                  <span>{cameraPermissionInstruction(permissionHelp.browser)}</span>
                </div>
                <p className="camera-permission-note">After changing it to Allow, you normally do not need to leave this page. Press Try Camera Again below.</p>
              </>}
          </div>
          <div className="camera-permission-actions">
            <button type="button" className="camera-permission-cancel" onClick={() => setPermissionHelp(null)}>Cancel</button>
            {permissionHelp.reason !== 'secure-context' && <button
              type="button"
              className="camera-permission-retry"
              onClick={() => {
                const mode = permissionHelp.mode;
                setPermissionHelp(null);
                startCamera(mode);
              }}
            ><Camera size={16}/> Try Camera Again</button>}
          </div>
        </div>
      </div>}

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
