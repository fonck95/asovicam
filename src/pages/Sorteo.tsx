import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Lock } from 'lucide-react';
import SEO from '../components/SEO';
import Button from '../components/ui/Button';
import MapaParcelas from '../components/sorteo/MapaParcelas';
import { mapaPredeterminado } from '../data/mapaPredeterminado';
import { cargarMapaDeArchivo } from '../utils/kml';
import {
  HASH_MAXIMO,
  calcularAsignaciones,
  codificarSorteo,
  codificarSorteoConMapa,
  colorDeParcela,
  decodificarSorteo,
  estadoSorteo,
  nuevaSemilla,
  parsearParticipantes,
} from '../utils/sorteo';
import type { SorteoConfig } from '../utils/sorteo';
import type { MapaSorteo } from '../types';
import styles from './Sorteo.module.css';

const SIN_ASIGNACIONES: ReadonlyMap<number, string> = new Map();

/** Cantidad de lotes contra la que se valida y sortea una configuración. */
function totalSegunConfig(c: SorteoConfig): number {
  return c.mapa?.lotes.length ?? mapaPredeterminado.lotes.length;
}

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
  mapa: MapaSorteo;
  esMapaPersonalizado: boolean;
  errorMapa: string | null;
  cargandoMapa: boolean;
  onCargarMapa: (archivo: File) => void;
  onRestaurarMapa: () => void;
  onIniciar: (config: SorteoConfig) => void;
}

function Configurador({
  mapa,
  esMapaPersonalizado,
  errorMapa,
  cargandoMapa,
  onCargarMapa,
  onRestaurarMapa,
  onIniciar,
}: ConfiguradorProps) {
  const [texto, setTexto] = useState('');
  const [intervaloS, setIntervaloS] = useState(6);
  const [esperaS, setEsperaS] = useState(60);
  const [permitirLibres, setPermitirLibres] = useState(false);
  const archivoRef = useRef<HTMLInputElement>(null);
  const archivoMapaRef = useRef<HTMLInputElement>(null);

  const totalLotes = mapa.lotes.length;
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
  const excedente = n > totalLotes;
  const completo = n === totalLotes;
  const puedeIniciar = n > 0 && !excedente && (completo || permitirLibres);

  const areaTotal = useMemo(() => {
    const suma = mapa.lotes.reduce((s, l) => s + (l.areaHa ?? 0), 0);
    return suma > 0 ? Math.round(suma * 10) / 10 : null;
  }, [mapa]);

  const cargarArchivo = (e: ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    void archivo.text().then(setTexto);
    e.target.value = '';
  };

  const cargarArchivoMapa = (e: ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (archivo) onCargarMapa(archivo);
    e.target.value = '';
  };

  const iniciar = () => {
    if (!puedeIniciar) return;
    onIniciar({
      v: 2,
      participantes,
      seed: nuevaSemilla(),
      inicio: Date.now() + esperaS * 1000,
      intervaloMs: intervaloS * 1000,
    });
  };

  return (
    <div className={styles.configurador}>
      <div className={`${styles.panel} ${styles.panelMapa}`}>
        <h2 className={styles.panelTitulo}>1. Mapa de lotes</h2>
        <p className={styles.ayuda}>
          Mapa actual: <strong>{mapa.nombre}</strong> — {totalLotes} lote(s)
          {areaTotal != null && <> · {areaTotal} ha en total</>}. Puedes usar
          otro mapa cargando un archivo <strong>KML o KMZ</strong> (por
          ejemplo, exportado desde Google My Maps o Google Earth): cada
          polígono del archivo se toma como un lote, y el polígono que
          envuelve a los demás se usa como lindero.
        </p>
        <div className={styles.filaAcciones}>
          <input
            ref={archivoMapaRef}
            type="file"
            accept=".kml,.kmz"
            onChange={cargarArchivoMapa}
            hidden
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => archivoMapaRef.current?.click()}
            disabled={cargandoMapa}
          >
            {cargandoMapa ? 'Cargando mapa…' : 'Cargar mapa KML/KMZ'}
          </Button>
          {esMapaPersonalizado && (
            <Button variant="outline" size="sm" onClick={onRestaurarMapa}>
              Volver al mapa precargado
            </Button>
          )}
        </div>
        {errorMapa && <p className={styles.error}>{errorMapa}</p>}
        <div className={styles.previewMapa}>
          <MapaParcelas
            lotes={mapa.lotes}
            limite={mapa.limite}
            asignaciones={SIN_ASIGNACIONES}
            enJuego={null}
            ultima={null}
            seguir={false}
          />
        </div>
      </div>

      <div className={styles.panel}>
        <h2 className={styles.panelTitulo}>2. Lista de participantes</h2>
        <p className={styles.ayuda}>
          Escribe una persona o agrupación por línea (por ejemplo, «Familia
          Pérez»), o carga un archivo .csv / .txt con los nombres en la
          primera columna. Debe haber la misma cantidad de participantes que
          de lotes: <strong>{totalLotes}</strong>.
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
            {n} / {totalLotes} participantes
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
            Hay {n - totalLotes} participante(s) de más: solo existen{' '}
            {totalLotes} lotes. Elimina los sobrantes para continuar.
          </p>
        )}
        {duplicados.length > 0 && (
          <p className={styles.aviso}>
            Nombres repetidos (se sortearán como participantes distintos):{' '}
            {duplicados.join(', ')}
          </p>
        )}
        {n > 0 && n < totalLotes && (
          <label className={styles.opcionLibres}>
            <input
              type="checkbox"
              checked={permitirLibres}
              onChange={(e) => setPermitirLibres(e.target.checked)}
            />
            Sortear con {n} participante(s): quedarán {totalLotes - n} lote(s)
            libres, elegidos también al azar.
          </label>
        )}
      </div>

      <div className={styles.panel}>
        <h2 className={styles.panelTitulo}>3. Ritmo del sorteo</h2>
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
          {esMapaPersonalizado && (
            <> El mapa cargado viaja dentro del mismo enlace.</>
          )}
        </p>
        <Button onClick={iniciar} disabled={!puedeIniciar} size="lg">
          Iniciar sorteo
        </Button>
      </div>
    </div>
  );
}

interface SorteoProps {
  /**
   * 'admin' (/admin/sorteo): herramienta completa para configurar y lanzar
   * sorteos. 'publico' (/sorteo): solo permite seguir en vivo un sorteo
   * recibido por enlace; sin enlace muestra el aviso de acceso restringido.
   */
  modo: 'admin' | 'publico';
}

export default function Sorteo({ modo }: SorteoProps) {
  const [configCruda, setConfigCruda] = useState<SorteoConfig | null>(() =>
    decodificarSorteo(window.location.hash),
  );
  const [mapaCargado, setMapaCargado] = useState<MapaSorteo | null>(null);
  const [errorMapa, setErrorMapa] = useState<string | null>(null);
  const [cargandoMapa, setCargandoMapa] = useState(false);
  const [ahora, setAhora] = useState(() => Date.now());
  const [seguir, setSeguir] = useState(true);
  const [copiado, setCopiado] = useState(false);

  // Un enlace solo es utilizable si sus participantes caben en su mapa.
  const config =
    configCruda && configCruda.participantes.length <= totalSegunConfig(configCruda)
      ? configCruda
      : null;
  const enlaceInvalido = configCruda !== null && config === null;

  // El mapa activo: el del enlace, el subido por el organizador o el fijo.
  const mapaActivo: MapaSorteo = config?.mapa ?? mapaCargado ?? mapaPredeterminado;
  const totalLotes = mapaActivo.lotes.length;

  // Soporta pegar otro enlace o navegar atrás/adelante.
  useEffect(() => {
    const onHash = () => setConfigCruda(decodificarSorteo(window.location.hash));
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
    () => (config ? calcularAsignaciones(config, totalSegunConfig(config)) : []),
    [config],
  );
  const estado = config ? estadoSorteo(config, ahora) : null;
  const reveladas = estado?.reveladas ?? 0;

  const mapaAsignaciones = new Map(
    asignaciones.slice(0, reveladas).map((a) => [a.parcelaIdx, a.participante]),
  );
  const nombresRestantes = asignaciones.slice(reveladas).map((a) => a.participante);

  const cargarMapa = (archivo: File) => {
    setCargandoMapa(true);
    setErrorMapa(null);
    cargarMapaDeArchivo(archivo)
      .then((mapa) => {
        if (mapa.lotes.length < 2) {
          throw new Error('El mapa debe tener al menos 2 lotes (polígonos).');
        }
        setMapaCargado(mapa);
      })
      .catch((e: unknown) => {
        setErrorMapa(e instanceof Error ? e.message : 'No se pudo leer el archivo.');
      })
      .finally(() => setCargandoMapa(false));
  };

  const iniciar = (base: SorteoConfig) => {
    let hash: string;
    let cfg = base;
    if (mapaCargado) {
      ({ hash, config: cfg } = codificarSorteoConMapa(base, mapaCargado));
      if (hash.length > HASH_MAXIMO) {
        window.alert(
          'El mapa cargado es muy detallado y el enlace del sorteo quedó ' +
            'muy largo. Funciona, pero algunos servicios de mensajería ' +
            'podrían recortarlo: verifica que el enlace llegue completo.',
        );
      }
    } else {
      hash = codificarSorteo(base);
    }
    window.location.hash = hash;
    setConfigCruda(cfg);
    setCopiado(false);
  };

  const nuevoSorteo = () => {
    if (!window.confirm('¿Salir de este sorteo y preparar uno nuevo?')) return;
    window.history.replaceState(null, '', window.location.pathname);
    setConfigCruda(null);
  };

  const copiarEnlace = () => {
    // Siempre se comparte la URL pública del visor (/sorteo#…), aunque el
    // organizador esté viendo el sorteo desde la ruta de administración.
    const enlacePublico = `${window.location.origin}/sorteo${window.location.hash}`;
    void navigator.clipboard.writeText(enlacePublico).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    });
  };

  const descargarCSV = () => {
    const filas = [['Lote', 'Área (ha)', 'Asignado a']];
    mapaActivo.lotes.forEach((l, idx) => {
      filas.push([
        l.nombre,
        l.areaHa != null ? String(l.areaHa) : '',
        mapaAsignaciones.get(idx) ?? 'Libre',
      ]);
    });
    const csv = filas
      .map((f) => f.map((c) => `"${c.replace(/"/g, '""')}"`).join(','))
      .join('\n');
    // BOM para que Excel abra el CSV como UTF-8.
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sorteo-lotes-asovicam.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const enJuego =
    estado?.fase === 'en_curso' && reveladas < asignaciones.length
      ? asignaciones[reveladas].parcelaIdx
      : null;
  const ultima = reveladas > 0 ? asignaciones[reveladas - 1].parcelaIdx : null;
  const loteEnJuego = enJuego != null ? mapaActivo.lotes[enJuego] : null;
  const ultimaAsignacion = reveladas > 0 ? asignaciones[reveladas - 1] : null;

  return (
    <>
      <SEO
        title={modo === 'admin' ? 'Sorteo de lotes — Administración' : 'Sorteo de lotes'}
        description="Sorteo en vivo de lotes sobre el mapa: los asistentes siguen cada asignación en tiempo real desde el enlace compartido por la organización."
        noindex
      />

      <section className={styles.hero}>
        <div className="container">
          <h1 className={styles.heroTitle}>Sorteo de lotes</h1>
          <p className={styles.heroSubtitle}>
            {!config && modo === 'publico' ? (
              <>
                Sigue en vivo la asignación de lotes desde el enlace que te
                comparta la organización.
              </>
            ) : (
              <>
                Asignación transparente y en vivo de los {totalLotes} lotes de{' '}
                {mapaActivo.nombre}. Todos los asistentes ven el mismo sorteo,
                al mismo tiempo, desde cualquier dispositivo.
              </>
            )}
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          {enlaceInvalido && (
            <p className={styles.error}>
              El enlace del sorteo no es válido: trae más participantes que
              lotes. Pide al organizador que lo genere de nuevo.
            </p>
          )}

          {!config && modo === 'admin' && (
            <Configurador
              mapa={mapaActivo}
              esMapaPersonalizado={mapaCargado !== null}
              errorMapa={errorMapa}
              cargandoMapa={cargandoMapa}
              onCargarMapa={cargarMapa}
              onRestaurarMapa={() => {
                setMapaCargado(null);
                setErrorMapa(null);
              }}
              onIniciar={iniciar}
            />
          )}

          {!config && modo === 'publico' && (
            <div className={styles.restringido}>
              <span className={styles.restringidoIcono} aria-hidden="true">
                <Lock size={26} />
              </span>
              <h2 className={styles.panelTitulo}>
                Herramienta de administración
              </h2>
              <p className={styles.ayuda}>
                La organización de sorteos se gestiona desde el panel de
                administración y ya no es pública. Si recibiste un enlace de
                un sorteo, ábrelo completo (incluye un código después del
                símbolo «#») para seguirlo en vivo desde aquí.
              </p>
            </div>
          )}

          {config && estado && (
            <div className={styles.envivo}>
              <div className={styles.mapaCaja}>
                <MapaParcelas
                  lotes={mapaActivo.lotes}
                  limite={mapaActivo.limite}
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
                      {totalLotes} lotes
                    </p>
                  </div>
                )}

                {estado.fase === 'en_curso' && loteEnJuego && (
                  <div className={`${styles.panel} ${styles.panelCentrado}`}>
                    <p className={styles.etiquetaFase}>Sorteando ahora</p>
                    <p className={styles.loteEnJuego}>
                      {loteEnJuego.nombre}
                      {loteEnJuego.areaHa != null && (
                        <span className={styles.area}> · {loteEnJuego.areaHa} ha</span>
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
                      <strong>{mapaActivo.lotes[ultimaAsignacion.parcelaIdx].nombre}</strong>{' '}
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
                            {mapaActivo.lotes[a.parcelaIdx].nombre}
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
                    {modo === 'admin' && (
                      <Button variant="outline" size="sm" onClick={nuevoSorteo}>
                        Nuevo sorteo
                      </Button>
                    )}
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
                      <th>Lote</th>
                      <th>Área</th>
                      <th>Asignado a</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mapaActivo.lotes.map((l, idx) => (
                      <tr key={idx}>
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
                          {l.nombre}
                        </td>
                        <td>{l.areaHa != null ? `${l.areaHa} ha` : '—'}</td>
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
