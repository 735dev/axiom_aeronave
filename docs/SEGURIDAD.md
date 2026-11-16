# Aeronave, front — cola de seguridad

Norma: `../../docs/seguridad/ESTANDAR.md`. La API está en `axiom_aeronave_backend/docs/SEGURIDAD.md`.

## Tareas

### AF-01 — El build no apunta a localhost cuando haya dominio

- Estado: `bloqueada`
- Capa: código
- ASVS: V3
- Se desbloquea junto con A-03 del backend, cuando el dominio de producción exista.
- Hecho cuando: el entorno de producción nombra ese dominio por HTTPS y las cabeceras de V3 están en el sitio que lo sirve.
- No hacer: no elegir un dominio.
