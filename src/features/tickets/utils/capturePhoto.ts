import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

/** Calidad JPEG de la captura nativa: la fotografía igual pasa por `prepareFile`. */
const NATIVE_QUALITY = 85;

/** No hubo foto porque la persona negó el permiso de cámara. */
export class CameraDenied extends Error {
  constructor() {
    super('camera-denied');
  }
}

/** En la app nativa se usa el plugin; en el navegador, el `<input capture>`. */
export function hasNativeCamera(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Camera');
}

function isCancel(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e ?? '');
  return /cancel/i.test(message);
}

function isDenied(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e ?? '');
  return /denied|permission/i.test(message);
}

/**
 * Abre la cámara del teléfono y devuelve la foto como `File`, lista para el
 * mismo camino que cualquier archivo elegido (`toAttachmentInput`).
 *
 * El WebView de Android ignora `capture` y abre el selector de fotos, de ahí el
 * plugin. Devuelve `null` si la persona cancela; lanza `CameraDenied` si negó el
 * permiso. La orientación EXIF se corrige en el plugin.
 */
export async function takeNativePhoto(): Promise<File | null> {
  try {
    const photo = await Camera.getPhoto({
      source: CameraSource.Camera,
      resultType: CameraResultType.Uri,
      quality: NATIVE_QUALITY,
      correctOrientation: true,
      saveToGallery: false,
    });
    if (!photo.webPath) return null;
    const blob = await (await fetch(photo.webPath)).blob();
    const mime = blob.type.startsWith('image/') ? blob.type : `image/${photo.format || 'jpeg'}`;
    return new File([blob], `foto-${Date.now()}.${photo.format || 'jpg'}`, { type: mime });
  } catch (e) {
    if (isCancel(e)) return null;
    if (isDenied(e)) throw new CameraDenied();
    throw e;
  }
}

/**
 * Punto único de captura. En nativo abre la cámara y entrega la foto a
 * `onFile`; en web llama a `openInput` (el `<input capture>` oculto).
 */
export async function capturePhoto(
  onFile: (file: File) => void | Promise<void>,
  openInput: () => void,
  onDenied?: () => void,
): Promise<void> {
  if (!hasNativeCamera()) {
    openInput();
    return;
  }
  try {
    const file = await takeNativePhoto();
    if (file) await onFile(file);
  } catch (e) {
    if (e instanceof CameraDenied) onDenied?.();
    else throw e;
  }
}
