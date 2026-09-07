import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useSession } from '@/context/session';
import { api } from '@/lib/api';

interface Conjunto {
  id: string;
  nombre: string;
  ciudad: string;
  departamento: string;
}

export default function HomeScreen() {
  const { session, signOut } = useSession();
  const [conjuntos, setConjuntos] = useState<Conjunto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Sube de a uno cada vez que se pide de nuevo. Es lo que vuelve a correr el efecto. */
  const [pedido, setPedido] = useState(0);

  /**
   * La carga vive DENTRO del efecto a proposito.
   *
   * Si la funcion se define afuera —en un `useCallback`— y el efecto solo la
   * llama, React la trata como si sus `setState` ocurrieran en el cuerpo del
   * efecto, y eso es una cascada de renders. Definida adentro es lo que la
   * regla llama un callback, que es justo lo que es: la respuesta llega
   * despues y ahi se escribe el estado.
   */
  useEffect(() => {
    let vivo = true;

    const traer = async () => {
      try {
        // Sincroniza el usuario con el backend y trae sus conjuntos.
        await api('/auth/me');
        const lista = await api<Conjunto[]>('/conjuntos');
        if (!vivo) return;
        setConjuntos(lista);
        // El error se limpia con la respuesta buena, no al pedirla: durante un
        // refresh se sigue viendo el mensaje anterior hasta que haya con que
        // reemplazarlo.
        setError(null);
      } catch (e) {
        if (vivo) setError(e instanceof Error ? e.message : 'No se pudo cargar');
      } finally {
        if (vivo) {
          setCargando(false);
          setRefrescando(false);
        }
      }
    };

    void traer();

    // Si salen de la pantalla mientras la respuesta viene en camino, `vivo`
    // evita escribirle estado a un componente que ya no esta.
    return () => {
      vivo = false;
    };
  }, [pedido]);

  /** Halar para refrescar. Es un evento, no un efecto: aca si se puede escribir estado. */
  const recargar = useCallback(() => {
    setRefrescando(true);
    setPedido((n) => n + 1);
  }, []);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedView style={styles.header}>
          <ThemedView>
            <ThemedText type="subtitle">Mis conjuntos</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {session?.user.email}
            </ThemedText>
          </ThemedView>
          <Pressable onPress={() => void signOut()}>
            <ThemedText type="link">Salir</ThemedText>
          </Pressable>
        </ThemedView>

        {cargando ? (
          <ActivityIndicator style={{ marginTop: Spacing.five }} />
        ) : (
          <FlatList
            data={conjuntos}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refrescando} onRefresh={recargar} />}
            ListEmptyComponent={
              <ThemedText type="small" themeColor="textSecondary">
                {error ?? 'Aun no perteneces a ningun conjunto.'}
              </ThemedText>
            }
            renderItem={({ item }) => (
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="smallBold">{item.nombre}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {item.ciudad}, {item.departamento}
                </ThemedText>
              </ThemedView>
            )}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: Spacing.four },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: Spacing.four,
  },
  list: { gap: Spacing.three, paddingBottom: BottomTabInset + Spacing.four },
  card: { padding: Spacing.four, borderRadius: Spacing.three, gap: Spacing.one },
});
