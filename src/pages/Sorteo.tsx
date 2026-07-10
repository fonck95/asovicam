import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import SEO from '../components/SEO';
import Button from '../components/ui/Button';
import MapaParcelas from '../components/sorteo/MapaParcelas';
import { parcelas } from '../data/parcelas';
import {
  calcularAsignaciones,
  codificarSorteo,
  colorDeParcela,
  decodificarSorteo,
  estadoSorteo,
  nuevaSemilla,
  parsearParticipantes,
} from '../utils/sorteo';
import type { SorteoConfig } from '../utils/sorteo';
import styles from './Sorteo.module.css';

const TOTAL_LOTES = parcelas.length;

function formatearCuenta(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(seg).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Nombre girando mientras se sortea un lote (efecto tómbola, solo visual). */
function Ruleta({ nombres }: { nombres: string[] }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 90);
    return () => clearInterval(id);
  }, []);
  if (nombres.length === 0) return null;
  return <span className={styles.ruleta}>{nombres[tick % nombres.length]}</span>;
}

interface ConfiguradorProps {
  onIniciar: (config: SorteoConfig) => void;
}

function Configurador({ onIniciar }: ConfiguradorProps) {
  const [texto, setTexto] = useState('');
  const [intervaloS, setIntervaloS] = useState(6);
  const [esperaS, setEsperaS] = useState(60);
  const [permitirLibres, setPermitirLibres] = useState(false);
  const archivoRef = useRef<HTMLInputElement>(null);

  const participantes = useMemo(() => parsearParticipantes(texto), [texto]);
  const duplicados = useMemo(() => {
    const vistos = new Set<string>();
    const dup = new Set<string>();
    for (const p of participantes) {
      if (vistos.has(p)) dup.add(p);
      vistos.add(p);
    }
    return [...dup];
  }, [participantes]);

  const n = participantes.length;
  const excedente = n > TOTAL_LOTES;
  const completo = n === TOTAL_LOTES;
  const puedeIniciar = n > 0 && !excedente && (completo || permitirLibres);

  const cargarArchivo = (e: ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    void archivo.text().then(setTexto);
    e.target.value = '';
  };

  const iniciar = () => {
    if (!puedeIniciar) return;
    onIniciar({
      v: 1,
      participantes,
      seed: nuevaSemilla(),
      inicio: Date.now() + esperaS * 1000,
      intervaloMs: intervaloS * 1000,
    });
  };

  return (
    <div className={styles.configurador}>
      <div className={styles.panel}>
        <h2 className={styles.panelTitulo}>1. Lista de participantes</h2>
        <p className={styles.ayuda}>
          Escribe una persona o agrupación por línea (por ejemplo, «Familia
          Pérez»), o carga un archivo .csv / .txt con los nombres en la
          primera columna. Debe haber la misma cantidad de participantes que
          de lotes: <strong>{TOTAL_LOTES}</strong>.
        </p>
        <textarea
          className={styles.lista}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={'Familia Pérez\nJuan Rodríguez\nGrupo Las Delicias\n…'}
          rows={12}
          aria-label="Lista de participantes, uno por línea"
        />
        <div className={styles.filaAcciones}>
          <span
            className={`${styles.contador} ${
              completo ? styles.contadorOk : excedente ? styles.contadorError : ''
            }`}
          >
            {n} / {TOTAL_LOTES} participantes
          </span>
          <input
            ref={archivoRef}
            type="file"
            accept=".csv,.txt"
            onChange={cargarArchivo}
            hidden
          />
          <Button variant="outline" size="sm" onClick={() => archivoRef.current?.click()}>
            Cargar archivo
          </Button>
          {n > 0 && (
            <Button variant="outline" size="sm" onClick={() => setTexto('')}>
              Limpiar
            </Button>
          )}
        </div>
        {excedente && (
          <p className={styles.error}>
            Hay {n - TOTAL_LOTES} participante(s) de más: solo existen{' '}
            {TOTAL_LOTES} lotes. Elimina los sobrantes para continuar.
          </p>
        )}
        {duplicados.length > 0 && (
          <p className={styles.aviso}>
            Nombres repetidos (se sortearán como participantes distintos):{' '}
            {duplicados.join(', ')}
          </p>
        )}
        {n > 0 && n < TOTAL_LOTES && (
          <label className={styles.opcionLibres}>
            <input
              type="checkbox"
              checked={permitirLibres}
              onChange={(e) => setPermitirLibres(e.target.checked)}
            />
            Sortear con {n} participante(s): quedarán {TOTAL_LOTES - n} lote(s)
            libres, elegidos también al azar.
          </label>
        )}
      </div>

      <div className={styles.panel}>
        <h2 className={styles.panelTitulo}>2. Ritmo del sorteo</h2>
        <div className={styles.campo}>
          <label htmlFor="espera">Espera antes de empezar</label>
          <select
            id="espera"
            value={esperaS}
            onChange={(e) => setEsperaS(Number(e.target.value))}
          >
            <option value={15}>15 segundos</option>
            <option value={30}>30 segundos</option>
            <option value={60}>1 minuto</option>
            <option value={120}>2 minutos</option>
            <option value={300}>5 minutos</option>
            <option value={600}>10 minutos</option>
          </select>
          <p className={styles.ayuda}>
            Tiempo para compartir el enlace y que todos alcancen a conectarse
            antes de la primera asignación.
          </p>
        </div>
        <div className={styles.campo}>
          <label htmlFor="intervalo">Tiempo entre cada lote</label>
          <select
            id="intervalo"
            value={intervaloS}
            onChange={(e) => setIntervaloS(Number(e.target.value))}
          >
            <option value={3}>3 segundos</option>
            <option value={6}>6 segundos</option>
            <option value={10}>10 segundos</option>
            <option value={15}>15 segundos</option>
            <option value={30}>30 segundos</option>
          </select>
        </div>
        <p className={styles.ayuda}>
          Al iniciar se genera un enlace único: compártelo por WhatsApp o
          redes y cada persona verá el sorteo avanzar en vivo en su propio
          teléfono, todos sincronizados a la misma hora.
        </p>
        <Button onClick={iniciar} disabled={!puedeIniciar} size="lg">
          Iniciar sorteo
        </Button>
      </div>
    </div>
  );
}

export default function Sorteo() {
  const [config, setConfig] = useState<SorteoConfig | null>(() =>
    decodificarSorteo(window.location.hash),
  );
  const [ahora, setAhora] = useState(() => Date.now());
  const [seguir, setSeguir] = useState(true);
  const [copiado, setCopiado] = useState(false);

  // Soporta pegar otro enlace o navegar atrás/adelante.
  useEffect(() => {
    const onHash = () => setConfig(decodificarSorteo(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Reloj del sorteo: 4 lecturas por segundo bastan para la cuenta regresiva.
  useEffect(() => {
    if (!config) return;
    const id = setInterval(() => setAhora(Date.now()), 250);
    return () => clearInterval(id);
  }, [config]);

  const asignaciones = useMemo(
    () => (config ? calcularAsignaciones(config, TOTAL_LOTES) : []),
    [config],
  );
  const estado = config ? estadoSorteo(config, ahora) : null;
  const reveladas = estado?.reveladas ?? 0;

  const mapaAsignaciones = new Map(
    asignaciones.slice(0, reveladas).map((a) => [a.parcelaIdx, a.participante]),
  );
  const nombresRestantes = asignaciones.slice(reveladas).map((a) => a.participante);

  const iniciar = (nueva: SorteoConfig) => {
    window.location.hash = codificarSorteo(nueva);
    setConfig(nueva);
    setCopiado(false);
  };

  const nuevoSorteo = () => {
    if (!window.confirm('¿Salir de este sorteo y preparar uno nuevo?')) return;
    window.history.replaceState(null, '', window.location.pathname);
    setConfig(null);
  };

  const copiarEnlace = () => {
    void navigator.clipboard.writeText(window.location.href).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    });
  };

  const descargarCSV = () => {
    const filas = [['Parcela', 'Área (ha)', 'Asignado a']];
    parcelas.forEach((p, idx) => {
      filas.push([p.nombre, p.areaHa != null ? String(p.areaHa) : '', mapaAsignaciones.get(idx) ?? 'Libre']);
    });
    const csv = filas
      .map((f) => f.map((c) => `"${c.replace(/"/g, '""')}"`).join(','))
      .join('\n');
    // BOM para que Excel abra el CSV como UTF-8.
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sorteo-parcelas-asovicam.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const enJuego =
    estado?.fase === 'en_curso' && reveladas < asignaciones.length
      ? asignaciones[reveladas].parcelaIdx
      : null;
  const ultima = reveladas > 0 ? asignaciones[reveladas - 1].parcelaIdx : null;
  const parcelaEnJuego = enJuego != null ? parcelas[enJuego] : null;
  const ultimaAsignacion = reveladas > 0 ? asignaciones[reveladas - 1] : null;

  return (
    <>
      <SEO
        title="Sorteo de parcelas"
        description="Sorteo público y en vivo de las parcelas del predio La Faraona entre las familias y agrupaciones de ASOVICAM."
      />

      <section className={styles.hero}>
        <div className="container">
          <h1 className={styles.heroTitle}>Sorteo de parcelas</h1>
          <p className={styles.heroSubtitle}>
            Asignación transparente y en vivo de los {TOTAL_LOTES} lotes del
            predio LA FARAONA. Todos los asistentes ven el mismo sorteo, al
            mismo tiempo, desde cualquier dispositivo.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          {!config && <Configurador onIniciar={iniciar} />}

          {config && estado && (
            <div className={styles.envivo}>
              <div className={styles.mapaCaja}>
                <MapaParcelas
                  asignaciones={mapaAsignaciones}
                  enJuego={enJuego}
                  ultima={ultima}
                  seguir={seguir}
                />
              </div>

              <aside className={styles.lateral}>
                {estado.fase === 'previa' && (
                  <div className={`${styles.panel} ${styles.panelCentrado}`}>
                    <p className={styles.etiquetaFase}>El sorteo comienza en</p>
                    <p className={styles.cuentaRegresiva}>
                      {formatearCuenta(estado.msParaInicio)}
                    </p>
                    <p className={styles.ayuda}>
                      Inicio: {new Date(config.inicio).toLocaleTimeString()} ·{' '}
                      {config.participantes.length} participante(s) ·{' '}
                      {TOTAL_LOTES} lotes
                    </p>
                  </div>
                )}

                {estado.fase === 'en_curso' && parcelaEnJuego && (
                  <div className={`${styles.panel} ${styles.panelCentrado}`}>
                    <p className={styles.etiquetaFase}>Sorteando ahora</p>
                    <p className={styles.loteEnJuego}>
                      {parcelaEnJuego.nombre}
                      {parcelaEnJuego.areaHa != null && (
                        <span className={styles.area}> · {parcelaEnJuego.areaHa} ha</span>
                      )}
                    </p>
                    <Ruleta nombres={nombresRestantes} />
                  </div>
                )}

                {estado.fase === 'finalizado' && (
                  <div className={`${styles.panel} ${styles.panelCentrado} ${styles.panelFinal}`}>
                    <p className={styles.etiquetaFase}>🎉 Sorteo finalizado</p>
                    <p className={styles.ayuda}>
                      {reveladas} lote(s) asignados. El resultado es el mismo
                      para todo el que abra este enlace.
                    </p>
                  </div>
                )}

                <div className={styles.panel}>
                  <div className={styles.progresoCabecera}>
                    <span>
                      {reveladas} / {config.participantes.length} asignados
                    </span>
                    <label className={styles.seguirMapa}>
                      <input
                        type="checkbox"
                        checked={seguir}
                        onChange={(e) => setSeguir(e.target.checked)}
                      />
                      Seguir en el mapa
                    </label>
                  </div>
                  <div
                    className={styles.progresoBarra}
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={config.participantes.length}
                    aria-valuenow={reveladas}
                  >
                    <div
                      className={styles.progresoRelleno}
                      style={{
                        width: `${(reveladas / config.participantes.length) * 100}%`,
                      }}
                    />
                  </div>

                  {ultimaAsignacion && estado.fase !== 'finalizado' && (
                    <p className={styles.ultimaRevelada} aria-live="polite">
                      Último:{' '}
                      <strong>{parcelas[ultimaAsignacion.parcelaIdx].nombre}</strong>{' '}
                      → {ultimaAsignacion.participante}
                    </p>
                  )}

                  <ol className={styles.feed}>
                    {asignaciones
                      .slice(0, reveladas)
                      .map((a, i) => ({ ...a, orden: i + 1 }))
                      .reverse()
                      .map((a) => (
                        <li key={a.parcelaIdx} className={styles.feedItem}>
                          <span
                            className={styles.feedColor}
                            style={{ background: colorDeParcela(a.parcelaIdx) }}
                            aria-hidden="true"
                          />
                          <span className={styles.feedLote}>
                            {parcelas[a.parcelaIdx].nombre}
                          </span>
                          <span className={styles.feedNombre}>{a.participante}</span>
                        </li>
                      ))}
                  </ol>
                </div>

                <div className={styles.panel}>
                  <div className={styles.botonera}>
                    <Button variant="secondary" size="sm" onClick={copiarEnlace}>
                      {copiado ? '¡Enlace copiado!' : 'Copiar enlace del sorteo'}
                    </Button>
                    {estado.fase === 'finalizado' && (
                      <Button variant="outline" size="sm" onClick={descargarCSV}>
                        Descargar resultados (CSV)
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={nuevoSorteo}>
                      Nuevo sorteo
                    </Button>
                  </div>
                  <p className={styles.notaTecnica}>
                    Sorteo verificable: semilla pública {config.seed}. El
                    orden se calcula con esa semilla en el dispositivo de cada
                    asistente, por lo que nadie puede alterar el resultado.
                  </p>
                </div>
              </aside>
            </div>
          )}

          {config && estado?.fase === 'finalizado' && (
            <div className={styles.tablaCaja}>
              <h2 className={styles.panelTitulo}>Resultado completo</h2>
              <div className={styles.tablaScroll}>
                <table className={styles.tabla}>
                  <thead>
                    <tr>
                      <th>Parcela</th>
                      <th>Área</th>
                      <th>Asignado a</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parcelas.map((p, idx) => (
                      <tr key={p.id}>
                        <td>
                          <span
                            className={styles.feedColor}
                            style={{
                              background: mapaAsignaciones.has(idx)
                                ? colorDeParcela(idx)
                                : 'var(--color-gray-300)',
                            }}
                            aria-hidden="true"
                          />
                          {p.nombre}
                        </td>
                        <td>{p.areaHa != null ? `${p.areaHa} ha` : '—'}</td>
                        <td>{mapaAsignaciones.get(idx) ?? <em>Libre</em>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
