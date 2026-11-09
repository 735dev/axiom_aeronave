import { describe, expect, it } from 'vitest';
import { PNG, USERS, dataUrlOfBytes, findTicket, loginAs, newExpense } from '@/test/mockApi';
import {
  BLACKBOX_MAX_BYTES,
  archiveFileName,
  blackboxState,
  dataUrlBytes,
  documentsOf,
  folderIdFor,
} from './blackbox';

const ops = () => loginAs(USERS.superuser);

function openOperation(s = ops()) {
  return findTicket(s, (t) => t.type_code === 'operation' && !t.status_is_final);
}

describe('adjuntos en Blackbox', () => {
  it('dataUrlBytes mide exacto con 0, 1 y 2 caracteres de relleno', () => {
    expect(dataUrlBytes(dataUrlOfBytes(3))).toBe(3);
    expect(dataUrlBytes(dataUrlOfBytes(4))).toBe(4);
    expect(dataUrlBytes(dataUrlOfBytes(5))).toBe(5);
    expect(dataUrlBytes('data:x;base64,')).toBe(0);
  });

  it('archiva en la carpeta de la operación y el ticket guarda solo la referencia', () => {
    const s = ops();
    const op = openOperation(s);
    const exp = newExpense(s, op.id).data;
    const res = s.post(`/tickets/${exp.id}/attachments/`, { name: 'r.png', mime: 'image/png', size: 9, data_url: PNG });
    expect(res.status).toBe(201);
    const file = res.data.files.at(-1);
    expect(file.storage).toMatchObject({ provider: 'blackbox', folder: `Maestro - ${folderIdFor(op.code, op.created_at)}` });
    expect(file.data_url).toBeUndefined();
    expect(documentsOf(folderIdFor(op.code, op.created_at)).some((d) => d.id === file.storage.document_id)).toBe(true);
  });

  it('el original se pide aparte con enlace que vence', () => {
    const s = ops();
    const exp = newExpense(s, openOperation(s).id).data;
    const t = s.post(`/tickets/${exp.id}/attachments/`, { name: 'r.png', mime: 'image/png', size: 9, data_url: PNG }).data;
    const link = s.get(`/tickets/${exp.id}/attachments/${t.files.at(-1).id}/download/`);
    expect(link.status).toBe(200);
    expect(link.data.url).toBe(PNG);
    const ttl = Date.parse(link.data.expires_at) - Date.now();
    expect(ttl).toBeGreaterThan(4 * 60_000);
    expect(ttl).toBeLessThanOrEqual(5 * 60_000);
  });

  it('descarga de archivo inexistente es 404', () => {
    const s = ops();
    const exp = newExpense(s, openOperation(s).id).data;
    expect(s.get(`/tickets/${exp.id}/attachments/nope/download/`).status).toBe(404);
  });

  it.each(['virus.exe', 'nota.txt', 'sin_extension', 'doble.pdf.exe'])('rechaza %s por extensión', (name) => {
    const s = ops();
    const exp = newExpense(s, openOperation(s).id).data;
    const res = s.post(`/tickets/${exp.id}/attachments/`, { name, mime: 'x/y', size: 9, data_url: PNG });
    expect(res.status).toBe(400);
    expect(res.data.codigo).toBe('extension');
  });

  it.each(['A.PDF', 'b.JpG', 'c.docx', 'd.jpeg'])('acepta %s sin importar mayúsculas', (name) => {
    const s = ops();
    const exp = newExpense(s, openOperation(s).id).data;
    expect(s.post(`/tickets/${exp.id}/attachments/`, { name, mime: 'x/y', size: 9, data_url: PNG }).status).toBe(201);
  });

  it('rechaza archivo vacío', () => {
    const s = ops();
    const exp = newExpense(s, openOperation(s).id).data;
    const res = s.post(`/tickets/${exp.id}/attachments/`, { name: 'a.pdf', mime: 'application/pdf', size: 0, data_url: 'data:application/pdf;base64,' });
    expect(res.data.codigo).toBe('vacio');
  });

  it('20 MB exactos pasan; 20 MB + 1 se rechazan con 413', () => {
    const s = ops();
    const exp = newExpense(s, openOperation(s).id).data;
    const ok = s.post(`/tickets/${exp.id}/attachments/`, { name: 'a.pdf', mime: 'application/pdf', size: 1, data_url: dataUrlOfBytes(BLACKBOX_MAX_BYTES) });
    expect(ok.status).toBe(201);
    const big = s.post(`/tickets/${exp.id}/attachments/`, { name: 'b.pdf', mime: 'application/pdf', size: 1, data_url: dataUrlOfBytes(BLACKBOX_MAX_BYTES + 1) });
    expect(big.status).toBe(413);
    expect(big.data.codigo).toBe('tamano');
  });

  it('un rechazo no deja nada archivado ni adjunto', () => {
    const s = ops();
    const exp = newExpense(s, openOperation(s).id).data;
    const before = blackboxState.docs.length;
    s.post(`/tickets/${exp.id}/attachments/`, { name: 'x.exe', mime: 'x/y', size: 9, data_url: PNG });
    expect(blackboxState.docs.length).toBe(before);
    expect(s.get(`/tickets/${exp.id}/`).data.files).toHaveLength(0);
  });

  it('misma Idempotency-Key no duplica el documento en Blackbox ni el adjunto', () => {
    const s = ops();
    const exp = newExpense(s, openOperation(s).id).data;
    const before = blackboxState.docs.length;
    const body = { name: 'r.png', mime: 'image/png', size: 9, data_url: PNG };
    const a = s.post(`/tickets/${exp.id}/attachments/`, body, 'k-dup');
    const b = s.post(`/tickets/${exp.id}/attachments/`, body, 'k-dup');
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(blackboxState.docs.length).toBe(before + 1);
    expect(s.get(`/tickets/${exp.id}/`).data.files).toHaveLength(1);
  });

  it('claves distintas guardan documentos distintos', () => {
    const s = ops();
    const exp = newExpense(s, openOperation(s).id).data;
    const body = { name: 'r.png', mime: 'image/png', size: 9, data_url: PNG };
    s.post(`/tickets/${exp.id}/attachments/`, body, 'k1');
    s.post(`/tickets/${exp.id}/attachments/`, body, 'k2');
    expect(s.get(`/tickets/${exp.id}/`).data.files).toHaveLength(2);
  });

  it('el tipo de documento sigue al campo de archivo del tipo de ticket', () => {
    const s = ops();
    const exp = newExpense(s, openOperation(s).id).data;
    const f = s.post(`/tickets/${exp.id}/attachments/`, { name: 'r.png', mime: 'image/png', size: 9, data_url: PNG }).data.files.at(-1);
    expect(f.document_type).toBe('comprobante');
  });
});

describe('orden automático en Blackbox', () => {
  it('la carpeta ordena por año, aeronave y correlativo', () => {
    expect(folderIdFor('YV2323-004-26', '2026-01-01')).toBe('2026-YV2323-004');
    const names = ['YV2323-001-27', 'YV2323-004-26', 'YV2528-003-26', 'YV2323-002-26'].map((c) =>
      folderIdFor(c, '2026-01-01'),
    );
    expect([...names].sort()).toEqual([
      '2026-YV2323-002',
      '2026-YV2323-004',
      '2026-YV2528-003',
      '2027-YV2323-001',
    ]);
  });

  it('lo que no cuelga de una operación va a SIN-OPERACION del año del registro', () => {
    expect(folderIdFor(undefined, '2026-08-10T10:00:00Z')).toBe('2026-SIN-OPERACION');
    expect(folderIdFor('basura', '2027-03-01T10:00:00Z')).toBe('2027-SIN-OPERACION');
  });

  it('el archivo se nombra ticket_tipo_secuencia_original', () => {
    const n = archiveFileName({
      ticketCode: 'TK-0002',
      documentType: 'comprobante',
      sequence: 3,
      originalName: 'Recibo Gasolina ñandú.JPG',
    });
    expect(n).toBe('TK-0002_comprobante_03_Recibo-Gasolina-nandu.jpg');
  });

  it('un nombre con rutas o símbolos no escapa de la carpeta', () => {
    const n = archiveFileName({
      ticketCode: 'TK-1',
      documentType: 'comprobante',
      sequence: 1,
      originalName: '../../etc/pass wd?.pdf',
    });
    expect(n).not.toMatch(/[\\/?]/);
    expect(n.endsWith('.pdf')).toBe(true);
  });

  it('los archivos de un gasto quedan numerados en orden de carga y por tipo', () => {
    const s = ops();
    const exp = newExpense(s, openOperation(s).id).data;
    const send = (key: string) =>
      s.post(`/tickets/${exp.id}/attachments/`, { name: 'r.png', mime: 'image/png', size: 9, data_url: PNG }, key)
        .data.files.at(-1).storage.filename;
    expect(send('o1')).toBe(`${exp.code}_comprobante_01_r.png`);
    expect(send('o2')).toBe(`${exp.code}_comprobante_02_r.png`);
  });

  it('el soporte de un reporte técnico se archiva como evidencia técnica en la carpeta de su operación', () => {
    const s = ops();
    const op = openOperation(s);
    const tech = s.post('/tickets/', { type_code: 'technical_report', title: 't', parent_id: op.id, payload: { description: 'x' } });
    expect(tech.status).toBe(201);
    const f = s.post(`/tickets/${tech.data.id}/attachments/`, { name: 'p.png', mime: 'image/png', size: 9, data_url: PNG, field_key: 'photo' });
    expect(f.data.files.at(-1)).toMatchObject({
      document_type: 'evidencia_tecnica',
      storage: { folder: `Maestro - ${folderIdFor(op.code, op.created_at)}` },
    });
  });

  it('un ticket suelto sin operación va a la carpeta SIN-OPERACION', () => {
    const s = ops();
    const loose = findTicket(s, (t) => !t.parent_code && !t.type_is_root);
    const r = s.post(`/tickets/${loose.id}/attachments/`, { name: 'p.png', mime: 'image/png', size: 9, data_url: PNG });
    expect(r.data.files.at(-1).storage.folder).toMatch(/^Maestro - \d{4}-SIN-OPERACION$/);
  });
});
