import { beforeEach, describe, expect, it, vi } from 'vitest';

const cap = vi.hoisted(() => ({ native: false, getPhoto: vi.fn() }));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => cap.native,
    isPluginAvailable: () => true,
  },
}));
vi.mock('@capacitor/camera', () => ({
  Camera: { getPhoto: cap.getPhoto },
  CameraResultType: { Uri: 'uri' },
  CameraSource: { Camera: 'CAMERA' },
}));

import { capturePhoto, hasNativeCamera, takeNativePhoto } from './capturePhoto';

const JPEG = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' });

beforeEach(() => {
  cap.native = false;
  cap.getPhoto.mockReset();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ blob: async () => JPEG }));
});

describe('capturePhoto', () => {
  it('en web usa el input oculto y no toca el plugin', async () => {
    const open = vi.fn();
    const onFile = vi.fn();
    await capturePhoto(onFile, open);
    expect(open).toHaveBeenCalledOnce();
    expect(onFile).not.toHaveBeenCalled();
    expect(cap.getPhoto).not.toHaveBeenCalled();
    expect(hasNativeCamera()).toBe(false);
  });

  it('en nativo pide la cámara con calidad 85 y orientación corregida', async () => {
    cap.native = true;
    cap.getPhoto.mockResolvedValue({
      webPath: 'http://localhost/_capacitor_file_/x.jpeg',
      format: 'jpeg',
    });
    const open = vi.fn();
    const onFile = vi.fn();
    await capturePhoto(onFile, open);
    expect(open).not.toHaveBeenCalled();
    expect(cap.getPhoto).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'CAMERA', quality: 85, correctOrientation: true }),
    );
    const file = onFile.mock.calls[0]?.[0] as File;
    expect(file).toBeInstanceOf(File);
    expect(file.type).toBe('image/jpeg');
    expect(file.name).toMatch(/\.jpeg$/);
    expect(file.size).toBe(4);
  });

  it('cancelar no entrega archivo ni error', async () => {
    cap.native = true;
    cap.getPhoto.mockRejectedValue(new Error('User cancelled photos app'));
    const onFile = vi.fn();
    await capturePhoto(onFile, vi.fn());
    expect(onFile).not.toHaveBeenCalled();
    expect(await takeNativePhoto()).toBeNull();
  });

  it('permiso negado avisa por onDenied', async () => {
    cap.native = true;
    cap.getPhoto.mockRejectedValue(new Error('User denied access to camera'));
    const onDenied = vi.fn();
    const onFile = vi.fn();
    await capturePhoto(onFile, vi.fn(), onDenied);
    expect(onDenied).toHaveBeenCalledOnce();
    expect(onFile).not.toHaveBeenCalled();
  });

  it('otros fallos se propagan', async () => {
    cap.native = true;
    cap.getPhoto.mockRejectedValue(new Error('boom'));
    await expect(capturePhoto(vi.fn(), vi.fn())).rejects.toThrow('boom');
  });
});
