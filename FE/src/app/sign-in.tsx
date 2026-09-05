import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/context/session';

type Mode = 'signin' | 'signup';

export default function SignInScreen() {
  const colors = useTheme();
  const { signInWithPassword, signUpWithPassword } = useSession();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === 'signin') {
        await signInWithPassword(email.trim(), password);
      } else {
        await signUpWithPassword(email.trim(), password);
        setInfo('Revisa tu correo para confirmar la cuenta.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ocurrio un error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.form}>
          <ThemedText type="title">Vecii</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Gestion de conjuntos residenciales
          </ThemedText>

          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.backgroundSelected }]}
            placeholder="Correo electronico"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.backgroundSelected }]}
            placeholder="Contrasena"
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {error && <ThemedText type="small" style={styles.error}>{error}</ThemedText>}
          {info && (
            <ThemedText type="small" themeColor="textSecondary">
              {info}
            </ThemedText>
          )}

          <Pressable
            style={[styles.button, { backgroundColor: colors.text }]}
            onPress={submit}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <ThemedText type="smallBold" themeColor="background">
                {mode === 'signin' ? 'Iniciar sesion' : 'Crear cuenta'}
              </ThemedText>
            )}
          </Pressable>

          <Pressable onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
            <ThemedText type="link">
              {mode === 'signin'
                ? 'No tienes cuenta? Registrate'
                : 'Ya tienes cuenta? Inicia sesion'}
            </ThemedText>
          </Pressable>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.four },
  form: { gap: Spacing.three, width: '100%', maxWidth: 380, alignSelf: 'center' },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  button: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  error: { color: '#E5484D' },
});
