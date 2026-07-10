import type { MapaSorteo } from '../types';
import { parcelas, limitePredio } from './parcelas';

/** Mapa precargado del sorteo: el predio LA FARAONA del My Maps oficial. */
export const mapaPredeterminado: MapaSorteo = {
  nombre: 'Predio LA FARAONA — ASOVICAM',
  lotes: parcelas,
  limite: limitePredio,
};
