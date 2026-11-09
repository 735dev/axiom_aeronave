import { expect, test, type Browser, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { Api, REAL, attachReceiptWith, receiptPng, signaturePng } from './support/world';

/**
 * Criterio de aceptación de la Fase 1 (Alcance §12): una operación recorre el ciclo completo
 * contra el backend REAL, con cada rol en su propia sesión. Solo corre en modo real: el simulador
 * no tiene servidor que pueda probar firma, candados de período ni bitácora inmutable.
 *
 * Lo que la interfaz hace se hace por la interfaz. Los trámites repetitivos que no son el objeto
 * de la prueba (decidir los pasos que faltan) van por HTTP con el usuario del rol que corresponde.
 */
test.skip(!REAL, 'requiere el backend real (npm run test:e2e:real)');
test.describe.configure({ mode: 'serial' });
test.setTimeout(240_000);

const RECIBO = fs.readFileSync(path.join(process.cwd(), 'e2e', 'recibo.png'));
const PHONE = { width: 390, height: 844 };

async function sessionAs(
  browser: Browser,
  email: string,
  viewport?: { width: number; height: number },
) {
  const context = await browser.newContext({
    baseURL: `http://localhost:${process.env.E2E_WEB_PORT ?? 4174}`,
    ...(viewport ? { viewport } : {}),
  });
  const page = await context.newPage();
  await page.goto('/login');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill('demo1234');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL('**/tickets');
  return page;
}

/** Primer mes (desde 2012) sin cierre, gastos ni tickets (una corrida abortada deja restos): cada corrida concilia el suyo. */
async function freeMonth(api: Api): Promise<string> {
  for (let i = 0; i < 240; i += 1) {
    const period = `${2012 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
    const report = (await api.get(`/reconciliation/?period=${period}`)).data;
    const used = (await api.get(`/tickets/?from=${period}-01&to=${period}-28&limit=1`)).data.total;
    if (!report.close && report.rows.length === 0 && used === 0) return period;
  }
  throw new Error('no queda un mes libre para conciliar');
}

/** La cola de validación es global: se vacía lo ajeno (corridas previas) para dejar solo lo propio. */
async function drainOthers(api: Api, keep: string) {
  type Item = {
    ticket_id: string;
    file: { id: string; extraction: { fields: { key: string; value: unknown }[] } };
  };
  const queue = (await api.get('/attachments/pending/?limit=50')).data.data as Item[];
  for (const item of queue) {
    if (item.ticket_id === keep) continue;
    const fields = item.file.extraction.fields.map((f) => ({ key: f.key, value: f.value }));
    await api.post(`/tickets/${item.ticket_id}/attachments/${item.file.id}/validate/`, {
      fields,
      confirmed: fields.map((f) => f.key),
    });
  }
}

async function decideAll(api: Api, ticketId: string, steps: string[], decision = 'done') {
  for (const step of steps) {
    await api.post(`/tickets/${ticketId}/decisions/`, { step_code: step, decision });
  }
}

const s = {
  ops: 'operaciones@transvalor.com',
  pilot: 'piloto@transvalor.com',
  maint: 'mantenimiento@transvalor.com',
  ground: 'tierra@transvalor.com',
  admin: 'admin@transvalor.com',
  super: 'super@transvalor.com',
};

test('una operación real recorre el ciclo completo (Alcance §12)', async ({ browser }) => {
  const su = await Api.as(s.super);
  const ops = await Api.as(s.ops);
  const pilot = await Api.as(s.pilot);
  const maint = await Api.as(s.maint);
  const ground = await Api.as(s.ground);
  const admin = await Api.as(s.admin);

  const period = await freeMonth(su);
  const day = `${period}-10`;
  let opId = '';
  let opCode = '';
  let expenseId = '';
  let expenseCode = '';
  let reportId = '';

  // 1. Gerencia de Operaciones crea la operación y los usuarios ven su misión en el teléfono.
  await test.step('1. crea la operación y el piloto ve su misión en el teléfono', async () => {
    const page = await sessionAs(browser, s.ops);
    await page
      .getByRole('button', { name: /Nuevo|Nueva/ })
      .first()
      .click();
    await page.getByRole('button', { name: /^Operación aérea/ }).click();
    await page.locator('input[name="date"]').fill(day);
    await page.locator('select[name="aircraft"]').selectOption('YV2323');
    await page.locator('select[name="origin"]').selectOption('CCS');
    await page.locator('select[name="destination"]').selectOption('PZO');
    await page.locator('input[name="exchange_rate"]').fill('40');
    await page.getByRole('button', { name: 'Crear' }).click();
    await expect(page.getByRole('button', { name: 'Crear' })).toHaveCount(0);

    const created = (await su.get(`/tickets/?is_root=true&from=${day}&to=${day}`)).data.data as {
      id: string;
      code: string;
      created_by: string;
    }[];
    expect(created).toHaveLength(1);
    opId = created[0]!.id;
    opCode = created[0]!.code;
    await page.context().close();

    const phone = await sessionAs(browser, s.pilot, PHONE);
    await phone.goto('/tickets?vista=mine');
    await expect(phone.getByText(opCode).first()).toBeVisible();
    await phone.context().close();

    reportId = (
      (await su.get(`/tickets/?parent_id=${opId}&type_code=technical_report`)).data.data as {
        id: string;
      }[]
    )[0]!.id;
  });

  // 2 y 3. El piloto fotografía el combustible; el sistema lee el comprobante y propone el renglón.
  let pilotPage!: Page;
  await test.step('2-3. el piloto fotografía el comprobante y el sistema propone el renglón', async () => {
    pilotPage = await sessionAs(browser, s.pilot, PHONE);
    await attachReceiptWith(pilotPage, opId, 'legible', RECIBO, { as: pilotPage });
    await expect(pilotPage.getByTestId('read-amount')).toBeVisible();
    await expect(pilotPage.getByTestId('read-supplier')).toBeVisible();
    await expect(pilotPage.locator('input[name="amount"]')).not.toHaveValue('');
    // Es un gasto de combustible dentro del mes que se va a conciliar.
    await pilotPage.locator('select[name="concept"]').selectOption('fuel');
    await pilotPage.locator('input[name="expense_date"]').fill(day);
    const confirm = pilotPage.getByRole('button', { name: 'Está bien' });
    while ((await confirm.count()) > 0) await confirm.first().click();
    await pilotPage.getByRole('button', { name: 'Crear' }).click();
    await expect(pilotPage.getByRole('button', { name: 'Crear' })).toHaveCount(0);

    const kids = (await su.get(`/tickets/?parent_id=${opId}&type_code=expense`)).data.data as {
      id: string;
      code: string;
      files: unknown[];
    }[];
    expect(kids).toHaveLength(1);
    expenseId = kids[0]!.id;
    expenseCode = kids[0]!.code;
    const full = (await su.get(`/tickets/${expenseId}/`)).data;
    expect(full.files).toHaveLength(1);
    expect(full.files[0].extraction.status).toBe('extracted');
    await pilotPage.context().close();
  });

  // 4. Administración abre la consola de validación, corrige un campo y aprueba.
  await test.step('4. administración corrige un campo del comprobante y aprueba', async () => {
    await drainOthers(admin, expenseId);
    const page = await sessionAs(browser, s.admin);
    await page.getByRole('link', { name: 'Validación' }).click();
    // La cola es de todo el sistema: se llega al comprobante de esta operación.
    await expect(page.getByRole('heading', { name: 'Validación de comprobantes' })).toBeVisible();
    await expect(page.getByText('en espera')).toBeVisible();
    const here = page.getByRole('main').getByRole('link', { name: expenseCode, exact: true });
    for (let i = 0; i < 40 && (await here.count()) === 0; i += 1) {
      await page.getByRole('button', { name: /Omitir/ }).click();
    }
    await expect(here).toBeVisible();
    // Se corrige monto y moneda: queda por encima de lo autorizado (500 USD).
    await page.getByTestId('review-amount').fill('800');
    await page.getByTestId('review-currency').fill('USD');
    // La fecha leída manda sobre la tecleada: se corrige al mes que se va a conciliar.
    await page.getByTestId('review-expense_date').fill(day);
    for (const seen of await page.locator('[data-testid^="seen-"]:not(:checked)').all()) {
      await seen.check();
    }
    await page.getByRole('button', { name: /Aprobar/ }).click();
    await expect(page.getByText('Comprobante validado').first()).toBeVisible();
    await page.context().close();

    const after = (await su.get(`/tickets/${expenseId}/`)).data;
    expect(after.files[0].extraction.status).toBe('validated');
    expect(after.files[0].extraction.validated_by).toBeTruthy();
    expect(after.files[0].extraction.corrections.map((c: { key: string }) => c.key)).toContain(
      'amount',
    );
    expect(after.money.amount).toBe(800);
    expect(after.money.currency).toBe('USD');
    expect(after.accounting_date).toBe(day);
  });

  // 5. El motor de reglas marca el gasto y exige aprobación de la dirección.
  await test.step('5. la regla marca el gasto y la dirección lo autoriza', async () => {
    const flagged = (await su.get(`/tickets/${expenseId}/`)).data;
    expect(flagged.rule_hits.map((h: { action: string }) => h.action)).toContain(
      'require_authorization',
    );
    // Sin visto bueno no cuenta como gasto confirmado.
    const blocked = await admin.call(
      'PATCH',
      `/tickets/${expenseId}/`,
      { status_code: 'verified' },
      false,
    );
    expect(blocked.status).toBe(422);

    const page = await sessionAs(browser, s.ops);
    await page.goto(`/tickets/${expenseId}`);
    await expect(page.getByText('Gasto mayor a 500 USD requiere autorización')).toBeVisible();
    await expect(page.getByTestId('authorization-stamp')).toHaveCount(0);
    await page.getByTestId('authorize-button').click();
    await expect(page.getByTestId('authorization-stamp')).toBeVisible();
    await page.context().close();

    const ok = await admin.call(
      'PATCH',
      `/tickets/${expenseId}/`,
      { status_code: 'verified' },
      false,
    );
    expect(ok.status).toBe(200);
  });

  // 6. El piloto registra la bitácora y levanta el reporte técnico con foto; mantenimiento responde.
  await test.step('6. bitácora del piloto, reporte con evidencia y respuesta de mantenimiento', async () => {
    const page = await sessionAs(browser, s.pilot, PHONE);
    await page.goto('/bitacora-rapida');
    await page.getByTestId('quicklog-operation').selectOption(opId);
    await page.getByTestId('quicklog-departure').fill('08:00');
    await page.getByTestId('quicklog-arrival').fill('09:30');
    await page.getByTestId('quicklog-finding').click();
    await page.getByTestId('quicklog-chip-engine').click();
    await page.getByTestId('quicklog-save').click();
    await expect(page.getByText('Bitácora guardada')).toBeVisible();

    await page.goto(`/tickets/${reportId}`);
    await page.getByTestId('attach-file-input').setInputFiles({
      name: 'evidencia.png',
      mimeType: 'image/png',
      buffer: receiptPng(77),
    });
    await expect(page.locator('img[alt="evidencia.jpg"]').first()).toBeVisible();
    await page.context().close();

    const report = (await su.get(`/tickets/${reportId}/`)).data;
    expect(report.payload.actual_departure).toBe('08:00');
    expect(report.payload.has_finding).toBe(true);
    expect(report.files.map((f: { document_type: string }) => f.document_type)).toContain(
      'evidencia_tecnica',
    );

    const mx = await sessionAs(browser, s.maint);
    await mx.goto(`/tickets/${reportId}`);
    await mx.getByRole('button', { name: 'Registrar' }).first().click();
    await mx
      .getByRole('dialog')
      .locator('textarea')
      .fill('Diagnóstico: filtro de combustible obstruido');
    await mx.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click();
    await expect(mx.getByText('Diagnóstico: filtro de combustible obstruido')).toBeVisible();
    await mx.context().close();
    // Mantenimiento trae `tickets.edit.technical_report`: escribe él mismo la acción correctiva.
    const written = await maint.call(
      'PATCH',
      `/tickets/${reportId}/`,
      { payload: { corrective_action: 'Se reemplazó el filtro de combustible' } },
      false,
    );
    expect(written.status).toBe(200);
    const answered = (await su.get(`/tickets/${reportId}/`)).data;
    expect(answered.payload.corrective_action).toContain('filtro');
    expect(answered.decisions.length).toBeGreaterThan(0);
  });

  // 7. El INAC sigue pendiente: el sistema avisa y no deja cerrar.
  let inacId = '';
  await test.step('7. el permiso INAC pendiente avisa y bloquea el cierre', async () => {
    const page = await sessionAs(browser, s.ops);
    await page.goto(`/tickets/${opId}`);
    await page
      .getByRole('button', { name: /Agregar/ })
      .first()
      .click();
    await page.getByRole('button', { name: /^Permiso de vuelo/ }).click();
    await page.getByRole('dialog').locator('select[name="scope"]').selectOption('domestic');
    await page.getByRole('button', { name: 'Crear' }).click();
    await expect(page.getByRole('button', { name: 'Crear' })).toHaveCount(0);

    inacId = (
      (await su.get(`/tickets/?parent_id=${opId}&type_code=inac_permit`)).data.data as {
        id: string;
      }[]
    )[0]!.id;

    await page.goto('/avisos');
    await expect(page.getByText('Permiso INAC pendiente').first()).toBeVisible();

    await page.goto(`/tickets/${opId}`);
    await expect(page.getByTestId('closing-blockers')).toBeVisible();
    await expect(page.getByTestId('sign-and-close')).toBeDisabled();
    await page.context().close();

    // El servidor no tiene otra puerta: el cambio de estado también se rechaza.
    const refused = await ops.call('PATCH', `/tickets/${opId}/`, { status_code: 'closed' }, false);
    expect(refused.status).toBe(422);
    const still = (await su.get(`/tickets/${opId}/`)).data;
    expect(still.status_code).not.toBe('closed');
  });

  // 8. El manifiesto de pasajeros queda ligado a la operación.
  await test.step('8. el manifiesto de pasajeros queda ligado a la operación', async () => {
    const page = await sessionAs(browser, s.ops);
    await page.goto(`/tickets/${opId}`);
    await page.getByRole('button', { name: /Agregar pasajero/ }).click();
    await page.getByPlaceholder('Nombre y apellido').last().fill('María José Pérez');
    await page.getByPlaceholder('Documento').last().fill('V-12.345.678');
    // El botón del manifiesto es el primero; el último es el de los datos de la operación.
    await page.getByRole('button', { name: 'Guardar' }).first().click();
    await expect(page.getByText('Manifiesto actualizado')).toBeVisible();

    const manifest = (await su.get(`/tickets/${opId}/passengers/`)).data;
    expect(manifest).toHaveLength(1);

    await page.goto('/pasajeros');
    await page.getByTestId('passenger-search-input').fill('maria jose');
    await expect(page.getByText(opCode).first()).toBeVisible();
    await page.context().close();
  });

  // 9. Total en ambas monedas, soportes y cierre firmado.
  await test.step('9. totales en ambas monedas, soportes y cierre firmado', async () => {
    // Un segundo gasto en bolívares, con su comprobante validado.
    const ves = (
      await pilot.post('/tickets/', {
        type_code: 'expense',
        title: 'Peaje en bolívares',
        parent_id: opId,
        payload: { concept: 'other', amount: 4000, currency: 'VES', expense_date: day },
      })
    ).data;
    const up = await pilot.upload(ves.id, receiptPng(5), 'peaje.png', 'support');
    const extraction = up.files[0].extraction;
    await admin.post(`/tickets/${ves.id}/attachments/${up.files[0].id}/validate/`, {
      fields: [
        { key: 'amount', value: '4000' },
        { key: 'currency', value: 'VES' },
        { key: 'expense_date', value: day },
        { key: 'concept', value: 'other' },
      ],
      confirmed: extraction.fields.map((f: { key: string }) => f.key),
    });
    await admin.patch(`/tickets/${ves.id}/`, { status_code: 'verified' });

    // Lo que falta del flujo: pasos de la operación y de sus hijos.
    await decideAll(su, reportId, [
      'report',
      'diagnosis',
      'movement',
      'commercial',
      'return',
      'verification',
      'airworthiness',
    ]);
    await su.patch(`/tickets/${reportId}/`, { status_code: 'solved' });
    await decideAll(su, inacId, ['request', 'payment', 'approval']);
    await su.patch(`/tickets/${inacId}/`, { status_code: 'approved' });
    await decideAll(ops, opId, ['planning']);
    await decideAll(pilot, opId, ['requirements', 'technical']);
    await decideAll(ground, opId, ['ground']);

    // La firma de quien cierra es la de su perfil.
    await ops.patch('/auth/me/signature/', {
      signature_url: `data:image/png;base64,${signaturePng().toString('base64')}`,
    });

    const page = await sessionAs(browser, s.ops);
    await page.goto(`/tickets/${opId}`);
    const totals = page.getByTestId('closing-totals');
    await expect(totals).toContainText('USD');
    await expect(totals).toContainText('VES');
    await expect(page.getByTestId('closing-support-group').first()).toBeVisible();
    await expect(page.getByTestId('sign-and-close')).toBeEnabled();
    await page.getByTestId('sign-and-close').click();
    await expect(page.getByTestId('closing-stamp')).toBeVisible();
    await expect(page.getByTestId('closing-stamp').locator('img')).toHaveAttribute(
      'src',
      /^data:image\/png/,
    );
    await page.context().close();

    const closed = (await su.get(`/tickets/${opId}/`)).data;
    expect(closed.status_code).toBe('closed');
    expect(closed.closing.signed_by).toBeTruthy();
    expect(
      closed.closing.totals.by_currency.map((c: { currency: string }) => c.currency).sort(),
    ).toEqual(['USD', 'VES']);
    // Cerrado es inmutable, sin excepción de rol.
    const edit = await su.call(
      'PATCH',
      `/tickets/${opId}/`,
      { payload: { observations: 'x' } },
      false,
    );
    expect(edit.status).toBe(409);
  });

  // 10. Administración concilia el período: lo respaldado cuadra y la diferencia queda señalada.
  await test.step('10. administración concilia el período', async () => {
    // Otra operación del mismo mes con un gasto sin comprobante: la diferencia que hay que señalar.
    const other = (
      await ops.post('/tickets/', {
        type_code: 'operation',
        title: 'Operación con gasto sin soporte',
        payload: {
          date: day,
          aircraft: 'YV2528',
          origin: 'CCS',
          destination: 'PZO',
          exchange_rate: 40,
        },
      })
    ).data;
    await pilot.post('/tickets/', {
      type_code: 'expense',
      title: 'Gasto sin comprobante',
      parent_id: other.id,
      payload: { concept: 'ice', amount: 30, currency: 'USD', expense_date: day },
    });

    // Quien no tiene `reconciliation.close` (piloto) recibe 403; Administración sí lo tiene y
    // solo lo frena la diferencia sin justificar (409/422, nunca 403).
    const pilotDenied = await pilot.call('POST', '/reconciliation/close/', { period }, false);
    expect(pilotDenied.status).toBe(403);
    const unjustified = await admin.call('POST', '/reconciliation/close/', { period }, false);
    expect([409, 422]).toContain(unjustified.status);
    const page = await sessionAs(browser, s.admin);
    await page.goto('/conciliacion');
    await page.locator('input[type="month"]').fill(period);
    await page.getByRole('button', { name: 'Consultar' }).click();
    await expect(page.getByText(expenseCode).first()).toBeVisible();
    await expect(page.getByText('Gasto sin comprobante').first()).toBeVisible();
    // Con una diferencia sin justificar el cierre no se puede ejecutar.
    await expect(page.getByRole('button', { name: 'Cerrar período' })).toBeDisabled();

    await page
      .getByPlaceholder('Por qué se acepta esta diferencia')
      .fill('Caja chica, comprobante en trámite');
    await page.getByRole('button', { name: 'Justificar' }).click();
    await expect(page.getByText('Justificación registrada')).toBeVisible();
    await page.context().close();

    // Administración cierra el período con su propio permiso `reconciliation.close`.
    const owner = await sessionAs(browser, s.admin);
    await owner.goto('/conciliacion');
    await owner.locator('input[type="month"]').fill(period);
    await owner.getByRole('button', { name: 'Consultar' }).click();
    await owner.getByRole('button', { name: 'Cerrar período' }).click();
    await owner.getByRole('button', { name: /Confirmar|Aceptar|Sí/ }).click();
    await expect(owner.getByTestId('closed-periods')).toContainText(period);
    await owner.context().close();

    const periods = (await su.get('/reconciliation/periods/')).data as { period: string }[];
    expect(periods.map((p) => p.period)).toContain(period);
    // Un período cerrado no admite gastos nuevos con fecha en él.
    const late = await pilot.call(
      'POST',
      '/tickets/',
      {
        type_code: 'expense',
        title: 'Gasto tardío',
        parent_id: other.id,
        payload: { concept: 'ice', amount: 10, currency: 'USD', expense_date: day },
      },
      false,
    );
    expect(late.status).toBe(409);
    expect(late.data.codigo).toBe('periodo_cerrado');
  });

  // 11. Un auditor reconstruye quién hizo qué y cuándo.
  await test.step('11. el auditor reconstruye quién hizo qué y cuándo', async () => {
    type Event = {
      action: string;
      actor_name: string;
      actor_role: string;
      at: string;
      summary: string;
    };
    const trailOf = async (id: string) =>
      (await su.get(`/audit/?entity=ticket&entity_id=${id}&limit=100`)).data.data as Event[];
    const op = await trailOf(opId);
    // Quién creó la operación y quién la cerró, con hora.
    expect(op.find((e) => e.action === 'create')!.actor_role).toBe('Gerencia de Operaciones');
    const closing = op.find((e) => e.action === 'status_change' && /→ Cerrada/.test(e.summary));
    expect(closing?.actor_role).toBe('Gerencia de Operaciones');
    // El intento de editar la operación ya cerrada también quedó registrado.
    expect(op.some((e) => e.action === 'denied' && /cerrado/.test(e.summary))).toBe(true);
    // El piloto quedó en la bitácora del reporte; la validación, en el gasto.
    const report = await trailOf(reportId);
    expect(report.some((e) => e.actor_role === 'Piloto')).toBe(true);
    const expense = await trailOf(expenseId);
    expect(expense.some((e) => e.actor_role === 'Administración')).toBe(true);
    expect([...op, ...report, ...expense].every((e) => e.at && e.actor_name)).toBe(true);

    const reconciliation = (await su.get('/audit/?entity=reconciliation&limit=50')).data.data as {
      entity_id: string;
      summary: string;
      actor_role: string;
    }[];
    expect(reconciliation.some((e) => e.entity_id === period && /Cerró/.test(e.summary))).toBe(
      true,
    );

    const page = await sessionAs(browser, s.super);
    await page.goto(`/tickets/${opId}`);
    await expect(page.getByText('Gerencia de Operaciones').first()).toBeVisible();
    await page.goto('/auditoria');
    await expect(page.locator('main, body').first()).toContainText(opCode);
    await page.context().close();
  });
});
