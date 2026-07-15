import React, { useState } from 'react';
import { StyleSheet, TextInput, Pressable, View, ActivityIndicator, KeyboardAvoidingView, Platform, useColorScheme, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { supabase } from '@/utils/supabase';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RegisterScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [businessName, setBusinessName] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleRegister = async () => {
    if (!email || !password || !name) {
      setErrorMsg('Nama, Email, dan Password wajib diisi.');
      return;
    }
    
    setIsLoading(true);
    setErrorMsg('');
    
    try {
      // 1. Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;

      if (authData.user) {
        // 2. Create user profile in umkm.user_profiles
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert({
            id: authData.user.id,
            name,
            email,
            phone_number: phone || null,
            business_name: businessName || null,
          });
          
        if (profileError) {
          console.error('Failed to create profile:', profileError);
          // Don't throw here, the user is authenticated, we can let them through
          // but ideally we should handle profile creation gracefully.
        }
        
        router.replace('/');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan saat mendaftar.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView 
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            
            <View style={styles.header}>
              <Pressable style={styles.backButton} onPress={() => router.back()}>
                <Feather name="arrow-left" size={24} color={isDark ? '#FFF' : '#000'} />
              </Pressable>
              <ThemedText style={styles.title} type="title">Buat Akun Baru</ThemedText>
              <ThemedText style={styles.subtitle}>Lengkapi data profil dan usaha Anda</ThemedText>
            </View>

            <View style={styles.form}>
              {errorMsg ? (
                <View style={styles.errorContainer}>
                  <Feather name="alert-circle" size={16} color={Colors.error} />
                  <ThemedText style={styles.errorText}>{errorMsg}</ThemedText>
                </View>
              ) : null}

              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>Nama Lengkap *</ThemedText>
                <TextInput
                  style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                  placeholder="Budi Santoso"
                  placeholderTextColor={isDark ? '#666' : '#999'}
                  value={name}
                  onChangeText={setName}
                />
              </View>

              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>Email *</ThemedText>
                <TextInput
                  style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                  placeholder="budi@email.com"
                  placeholderTextColor={isDark ? '#666' : '#999'}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </View>

              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>Password *</ThemedText>
                <TextInput
                  style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                  placeholder="Minimal 6 karakter"
                  placeholderTextColor={isDark ? '#666' : '#999'}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>
              
              <View style={styles.divider} />
              <ThemedText style={styles.sectionTitle}>Data Tambahan (Opsional)</ThemedText>

              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>Nomor Telepon</ThemedText>
                <TextInput
                  style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                  placeholder="08123456789"
                  placeholderTextColor={isDark ? '#666' : '#999'}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>Nama Usaha/Toko</ThemedText>
                <TextInput
                  style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                  placeholder="Toko Budi Jaya"
                  placeholderTextColor={isDark ? '#666' : '#999'}
                  value={businessName}
                  onChangeText={setBusinessName}
                />
              </View>

              <Pressable 
                style={({ pressed }) => [
                  styles.button,
                  pressed && styles.buttonPressed
                ]}
                onPress={handleRegister}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <ThemedText style={styles.buttonText}>Daftar</ThemedText>
                )}
              </Pressable>

              <View style={styles.footer}>
                <ThemedText style={styles.footerText}>Sudah punya akun? </ThemedText>
                <Pressable onPress={() => router.push('/(auth)/login')}>
                  <ThemedText style={styles.linkText}>Masuk</ThemedText>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.xl,
    flexGrow: 1,
  },
  header: {
    marginBottom: Spacing.xl,
    marginTop: Spacing.md,
  },
  backButton: {
    marginBottom: Spacing.lg,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
  },
  form: {
    gap: Spacing.lg,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#444',
    opacity: 0.2,
    marginVertical: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: -Spacing.sm,
  },
  inputGroup: {
    gap: Spacing.xs,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  inputLight: {
    borderColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
    color: '#000000',
  },
  inputDark: {
    borderColor: '#333333',
    backgroundColor: '#1C1C1E',
    color: '#FFFFFF',
  },
  button: {
    backgroundColor: Colors.primary,
    height: 52,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.md,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.xxl,
  },
  footerText: {
    fontSize: 14,
    opacity: 0.7,
  },
  linkText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '700',
  },
});
