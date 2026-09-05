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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      // Sincroniza el usuario con el backend y trae sus conjuntos.
      await api('/auth/me');
      setConjuntos(await api<Conjunto[]>('/conjuntos'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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

        {loading ? (
          <ActivityIndicator style={{ marginTop: Spacing.five }} />
        ) : (
          <FlatList
            data={conjuntos}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={false} onRefresh={() => void load()} />}
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
