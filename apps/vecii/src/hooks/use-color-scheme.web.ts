import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * En web la app se renderiza estatica (`web.output: "static"` en app.json), asi
 * que el HTML se arma en el build, cuando todavia no existe `matchMedia` y no
 * hay forma de saber el tema del sistema. Hasta que el navegador hidrata, se
 * devuelve 'light' a proposito: si el servidor dijera 'dark' y el navegador
 * 'light', React vota que el HTML no coincide y vuelve a pintar todo.
 *
 * `useSyncExternalStore` es la forma de preguntar "¿ya hidrato?" sin escribir
 * estado dentro de un efecto: devuelve `false` en el build y `true` en el
 * navegador, y React se encarga del cambio.
 */
const suscribir = () => () => {};
const enElNavegador = () => true;
const enElBuild = () => false;

export function useColorScheme() {
  const hidratado = useSyncExternalStore(suscribir, enElNavegador, enElBuild);
  const scheme = useRNColorScheme();
  return hidratado ? scheme : 'light';
}
