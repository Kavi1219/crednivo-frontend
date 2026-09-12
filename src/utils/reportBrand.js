import crednivoGoldMarkUrl from '../assets/brand/crednivo-gold-mark.png';

let bytesPromise;
let dataUrlPromise;

export function getCrednivoLogoBytes() {
  if (!bytesPromise) {
    bytesPromise = fetch(crednivoGoldMarkUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`Unable to load report logo (${response.status})`);
        return response.arrayBuffer();
      })
      .then((buffer) => new Uint8Array(buffer));
  }
  return bytesPromise;
}

export function getCrednivoLogoDataUrl() {
  if (!dataUrlPromise) {
    dataUrlPromise = getCrednivoLogoBytes().then((bytes) => {
      let binary = '';
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      return `data:image/png;base64,${btoa(binary)}`;
    });
  }
  return dataUrlPromise;
}
