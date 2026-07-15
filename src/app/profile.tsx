import React, { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, TextInput, Pressable, Platform,
  useColorScheme, ScrollView, KeyboardAvoidingView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing, Colors, BorderRadius } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/utils/supabase';
import { useTransactionStore } from '@/store/transactionStore';
import { useProductStore } from '@/store/productStore';

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[isDark ? 'dark' : 'light'];

  const { session, userProfile, fetchProfile, signOut } = useAuthStore();
  const { transactions } = useTransactionStore();
  const { products } = useProductStore();

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (userProfile) {
      setName(userProfile.name || '');
      setPhone(userProfile.phone_number || '');
      setBusinessName(userProfile.business_name || '');
    }
  }, [userProfile]);

  const handleSave = async () => {
    if (!session?.user?.id) return;
    setIsSaving(true);
    setSuccessMsg('');

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          name,
          phone_number: phone || null,
          business_name: businessName || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.user.id);

      if (!error) {
        setSuccessMsg('Profil berhasil disimpan!');
        setIsEditing(false);
        fetchProfile();
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch {
      // non-blocking
    } finally {
      setIsSaving(false);
    }
  };

  // Stats
  const totalTransactions = transactions.length;
  const totalProducts = products.length;
  const syncedCount = transactions.filter((t) => t.synced).length;
  const unsyncedCount = totalTransactions - syncedCount;

  const statCard = (icon: string, label: string, value: string, iconColor: string) => (
    <ThemedView type="backgroundElement" style={[styles.statCard, { borderColor: colors.backgroundSelected }]}>
      <Feather name={icon as any} size={18} color={iconColor} />
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </ThemedView>
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: BottomTabInset + 80 }]}
            showsVerticalScrollIndicator={false}>

            {/* Header */}
            <View style={styles.header}>
              <ThemedText type="title">Profil Saya</ThemedText>
              <ThemedText themeColor="textSecondary">Kelola data diri dan informasi usaha</ThemedText>
            </View>

            {/* Avatar + Name */}
            <ThemedView type="backgroundElement"
              style={[styles.avatarCard, { borderColor: colors.backgroundSelected }]}>
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarText}>
                  {(userProfile?.name || session?.user?.email || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={[styles.displayName, { color: colors.text }]}>
                {userProfile?.name || 'Pengguna'}
              </Text>
              <Text style={styles.displayEmail}>{session?.user?.email || '-'}</Text>
              {userProfile?.business_name && (
                <View style={[styles.businessBadge, { backgroundColor: colors.backgroundSelected }]}>
                  <Feather name="briefcase" size={12} color={colors.primary} />
                  <Text style={[styles.businessText, { color: colors.primary }]}>
                    {userProfile.business_name}
                  </Text>
                </View>
              )}
            </ThemedView>

            {/* Stats */}
            <View style={styles.statsRow}>
              {statCard('file-text', 'Transaksi', String(totalTransactions), '#7c3aed')}
              {statCard('package', 'Produk', String(totalProducts), '#22c55e')}
              {statCard('cloud', 'Tersinkron', String(syncedCount), '#3b82f6')}
              {statCard('database', 'Lokal', String(unsyncedCount), '#f59e0b')}
            </View>

            {/* Profile Form */}
            <ThemedView type="backgroundElement"
              style={[styles.formCard, { borderColor: colors.backgroundSelected }]}>
              <View style={styles.cardHeader}>
                <Feather name="user" size={14} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>Data Profil</Text>
                <Pressable onPress={() => setIsEditing(!isEditing)}
                  style={[styles.editBtn, { backgroundColor: colors.backgroundSelected }]}>
                  <Feather name={isEditing ? 'x' : 'edit-2'} size={12} color={colors.primary} />
                  <Text style={[styles.editBtnText, { color: colors.primary }]}>
                    {isEditing ? 'Batal' : 'Edit'}
                  </Text>
                </Pressable>
              </View>

              {successMsg ? (
                <View style={styles.successBanner}>
                  <Feather name="check-circle" size={14} color="#22c55e" />
                  <Text style={styles.successText}>{successMsg}</Text>
                </View>
              ) : null}

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Nama Lengkap</Text>
                <TextInput value={name} onChangeText={setName} editable={isEditing}
                  placeholder="Nama Anda"
                  placeholderTextColor={colors.textSecondary}
                  style={[styles.input, { color: colors.text, borderColor: colors.backgroundSelected },
                    !isEditing && styles.inputDisabled]} />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Email</Text>
                <TextInput value={session?.user?.email || ''} editable={false}
                  style={[styles.input, { color: colors.textSecondary, borderColor: colors.backgroundSelected },
                    styles.inputDisabled]} />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Nomor Telepon</Text>
                <TextInput value={phone} onChangeText={setPhone} editable={isEditing}
                  keyboardType="phone-pad" placeholder="08123456789"
                  placeholderTextColor={colors.textSecondary}
                  style={[styles.input, { color: colors.text, borderColor: colors.backgroundSelected },
                    !isEditing && styles.inputDisabled]} />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Nama Usaha</Text>
                <TextInput value={businessName} onChangeText={setBusinessName} editable={isEditing}
                  placeholder="Toko/Warung/Usaha Anda"
                  placeholderTextColor={colors.textSecondary}
                  style={[styles.input, { color: colors.text, borderColor: colors.backgroundSelected },
                    !isEditing && styles.inputDisabled]} />
              </View>

              {isEditing && (
                <Pressable onPress={handleSave} disabled={isSaving}
                  style={[styles.saveBtn, { backgroundColor: colors.primary }]}>
                  {isSaving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>Simpan Perubahan</Text>
                  )}
                </Pressable>
              )}
            </ThemedView>

            {/* Logout */}
            <Pressable onPress={signOut}
              style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.7 }]}>
              <Feather name="log-out" size={16} color="#ef4444" />
              <Text style={styles.logoutText}>Keluar Akun</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth },
  scroll: { paddingHorizontal: Spacing.four },
  header: {
    paddingTop: Platform.OS === 'web' ? 88 : Spacing.three,
    paddingBottom: Spacing.three,
  },

  // Avatar card
  avatarCard: {
    padding: Spacing.four, borderRadius: BorderRadius.medium, borderWidth: 1.5,
    alignItems: 'center', marginBottom: Spacing.three,
  },
  avatar: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.two,
  },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '800' },
  displayName: { fontSize: 18, fontWeight: '800', marginBottom: 2 },
  displayEmail: { fontSize: 13, color: '#9ca3af', fontWeight: '600' },
  businessBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.two, paddingVertical: 4,
    borderRadius: BorderRadius.full, marginTop: Spacing.two,
  },
  businessText: { fontWeight: '700', fontSize: 12 },

  // Stats
  statsRow: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.three, flexWrap: 'wrap' },
  statCard: {
    flex: 1, minWidth: 70, padding: Spacing.two, borderRadius: BorderRadius.medium, borderWidth: 1.5,
    alignItems: 'center', gap: 4,
  },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 9, fontWeight: '700', color: '#9ca3af' },

  // Form card
  formCard: {
    padding: Spacing.three, borderRadius: BorderRadius.medium, borderWidth: 1.5,
    marginBottom: Spacing.three,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.three },
  cardTitle: { fontWeight: '800', fontSize: 13, flex: 1 },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.two, paddingVertical: 4, borderRadius: BorderRadius.small,
  },
  editBtnText: { fontWeight: '800', fontSize: 11 },

  successBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(34,197,94,.1)', padding: Spacing.two,
    borderRadius: BorderRadius.small, marginBottom: Spacing.two,
  },
  successText: { color: '#22c55e', fontWeight: '700', fontSize: 12 },

  fieldGroup: { marginBottom: Spacing.two },
  fieldLabel: { fontSize: 11, fontWeight: '700', marginBottom: Spacing.one },
  input: {
    borderWidth: 1.5, borderRadius: BorderRadius.small,
    paddingHorizontal: Spacing.two,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 14, fontWeight: '600',
  },
  inputDisabled: { opacity: 0.6 },

  saveBtn: {
    paddingVertical: Spacing.two + 4, borderRadius: BorderRadius.medium,
    alignItems: 'center', marginTop: Spacing.two,
  },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: Spacing.three, marginBottom: Spacing.three,
  },
  logoutText: { color: '#ef4444', fontWeight: '800', fontSize: 14 },
});
