// Roles permitidos según el requerimiento
export const ROLES = {
  ESTUDIANTE: 'ESTUDIANTE',
  TECNICO: 'TECNICO',
  SUPERVISOR: 'SUPERVISOR'
};

// Estados y tiempos máximos de SLA en horas
export const ESTADOS = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En proceso',
  RESUELTO: 'Resuelto',
  VERIFICADO: 'Verificado'
};

export const SLA_HORAS = {
  CRITICA: 4,
  ALTA: 24,
  MEDIA: 72,
  BAJA: 168
};

// Almacén en memoria
export let incidencias = [];
export let historial = [];