import React, { useState, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  Platform,
  useColorScheme,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing, Colors, BorderRadius } from '@/constants/theme';
import { useTransactionStore, getMonthKey } from '@/store/transactionStore';
import { useProjectionStore, CapExItem } from '@/store/projectionStore';
import { useProductStore } from '@/store/productStore';

const CAPEX_CATEGORIES = ['Mesin', 'Kendaraan', 'Renovasi', 'Digital', 'Lainnya'] as const;

export default function FutureScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[isDark ? 'dark' : 'light'];

  const { transactions } = useTransactionStore();
  const { products } = useProductStore();
  const {
    capexItems,
    monthlyTargetIncome,
    growthRatePercent,
    addCapEx,
    deleteCapEx,
    setMonthlyTarget,
    setGrowthRate,
    syncProjections,
  } = useProjectionStore();

  // ── CapEx form state ─────────────────────────────────────────────────────────
  const [showCapExForm, setShowCapExForm] = useState(false);
  const [capexName, setCapexName] = useState('');
  const [capexAmount, setCapexAmount] = useState('');
  const [capexReturn, setCapexReturn] = useState('');
  const [capexCategory, setCapexCategory] = useState<string>('Mesin');
  const [capexNotes, setCapexNotes] = useState('');

  // ── Target / Growth form state ───────────────────────────────────────────────
  const [targetInput, setTargetInput] = useState(monthlyTargetIncome > 0 ? String(monthlyTargetIncome) : '');
  const [growthInput, setGrowthInput] = useState(String(growthRatePercent));

  useEffect(() => {
    setTargetInput(monthlyTargetIncome > 0 ? String(monthlyTargetIncome) : '');
  }, [monthlyTargetIncome]);

  useEffect(() => {
    setGrowthInput(String(growthRatePercent));
  }, [growthRatePercent]);

  // ── Historical data calculations ─────────────────────────────────────────────
  const { thisMonthIncome, lastMonthIncome, avgMonthlyNetCash } = useMemo(() => {
    const now = new Date();
    const thisKey = getMonthKey(now.toISOString());
    const lastDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastKey = getMonthKey(lastDate.toISOString());

    const thisMonthIncome = transactions
      .filter((t) => t.type === 'pemasukan' && getMonthKey(t.date) === thisKey)
      .reduce((s, t) => s + t.total, 0);

    const lastMonthIncome = transactions
      .filter((t) => t.type === 'pemasukan' && getMonthKey(t.date) === lastKey)
      .reduce((s, t) => s + t.total, 0);

    // Aggregate net cash per month from ALL historical data
    const monthMap: Record<string, number> = {};
    transactions.forEach((t) => {
      const mk = getMonthKey(t.date);
      monthMap[mk] = (monthMap[mk] ?? 0) + t.profit;
    });
    const monthValues = Object.values(monthMap);
    const avgMonthlyNetCash =
      monthValues.length > 0 ? monthValues.reduce((s, v) => s + v, 0) / monthValues.length : 0;

    return { thisMonthIncome, lastMonthIncome, avgMonthlyNetCash };
  }, [transactions]);

  // Growth Rate %
  const actualGrowthRate =
    lastMonthIncome > 0
      ? ((thisMonthIncome - lastMonthIncome) / lastMonthIncome) * 100
      : null;

  // Cashflow Forecast: next 6 months based on thisMonth + growthRate
  const forecastMonths = useMemo(() => {
    const base = thisMonthIncome > 0 ? thisMonthIncome : avgMonthlyNetCash;
    const rate = growthRatePercent / 100;
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
      const label = d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
      return { label, value: Math.round(base * Math.pow(1 + rate, i + 1)) };
    });
  }, [thisMonthIncome, avgMonthlyNetCash, growthRatePercent]);

  const maxForecast = Math.max(...forecastMonths.map((f) => f.value), 1);

  // Payback period for each CapEx item
  const getPayback = (item: CapExItem): string => {
    const annualReturn = item.expectedMonthlyReturn * 12;
    if (annualReturn <= 0) return '∞';
    const years = item.investmentAmount / annualReturn;
    if (years < 1 / 12) return '< 1 bulan';
    if (years < 1) return `${Math.round(years * 12)} bulan`;
    return `${years.toFixed(1)} tahun`;
  };

  // PPh UMKM estimate (0.5% of monthly omset bruto)
  const monthlyOmset = transactions
    .filter((t) => {
      const mk = getMonthKey(t.date);
      const thisKey = getMonthKey(new Date().toISOString());
      return t.type === 'pemasukan' && mk === thisKey;
    })
    .reduce((s, t) => s + t.total, 0);
  const pphEstimate = monthlyOmset * 0.005;

  // Operational expenses this month (fixed cost for BEP calculation)
  const monthKey = getMonthKey(new Date().toISOString());
  const monthExpenses = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'pengeluaran' && getMonthKey(t.date) === monthKey)
      .reduce((sum, t) => sum + t.total + (t.operasionalCost || 0), 0);
  }, [transactions, monthKey]);

  const handleAddCapEx = () => {
    const amount = parseFloat(capexAmount.replace(/\D/g, ''));
    const monthly = parseFloat(capexReturn.replace(/\D/g, ''));
    if (!capexName || isNaN(amount) || amount <= 0) return;
    addCapEx({
      name: capexName,
      investmentAmount: amount,
      expectedMonthlyReturn: isNaN(monthly) ? 0 : monthly,
      purchaseDate: new Date().toISOString(),
      category: capexCategory,
      notes: capexNotes,
    });
    setCapexName('');
    setCapexAmount('');
    setCapexReturn('');
    setCapexNotes('');
    setShowCapExForm(false);
    syncProjections();
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingBottom: BottomTabInset + Spacing.six }]}
            showsVerticalScrollIndicator={false}
          >
            {/* ── Header ── */}
            <View style={styles.header}>
              <ThemedText type="title">Proyeksi & Rencana</ThemedText>
              <ThemedText themeColor="textSecondary">
                Perencanaan strategis & pertumbuhan bisnis Anda
              </ThemedText>
            </View>

            {/* ── Growth Rate Card ── */}
            <ThemedView
              type="backgroundElement"
              style={[styles.card, { borderColor: colors.backgroundSelected }]}
            >
              <View style={styles.cardHeader}>
                <Feather name="trending-up" size={14} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  Pertumbuhan Pendapatan (Growth Rate)
                </Text>
              </View>
              <View style={styles.growthRow}>
                <View style={styles.growthStat}>
                  <Text style={styles.growthStatLabel}>Bulan Lalu</Text>
                  <Text style={[styles.growthStatValue, { color: colors.text }]}>
                    Rp{lastMonthIncome.toLocaleString('id-ID')}
                  </Text>
                </View>
                <Feather name="arrow-right" size={16} color={colors.textSecondary} />
                <View style={styles.growthStat}>
                  <Text style={styles.growthStatLabel}>Bulan Ini</Text>
                  <Text style={[styles.growthStatValue, { color: colors.text }]}>
                    Rp{thisMonthIncome.toLocaleString('id-ID')}
                  </Text>
                </View>
                <View
                  style={[
                    styles.growthBadge,
                    {
                      backgroundColor:
                        actualGrowthRate === null
                          ? 'rgba(156,163,175,.15)'
                          : actualGrowthRate >= 0
                          ? 'rgba(34,197,94,.15)'
                          : 'rgba(239,68,68,.15)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.growthBadgeText,
                      {
                        color:
                          actualGrowthRate === null
                            ? colors.textSecondary
                            : actualGrowthRate >= 0
                            ? '#22c55e'
                            : '#ef4444',
                      },
                    ]}
                  >
                    {actualGrowthRate === null
                      ? 'N/A'
                      : `${actualGrowthRate >= 0 ? '+' : ''}${actualGrowthRate.toFixed(1)}%`}
                  </Text>
                </View>
              </View>
              <Text style={[styles.formula, { color: colors.textSecondary }]}>
                Growth = (Bulan Ini − Bulan Lalu) ÷ Bulan Lalu × 100%
              </Text>
            </ThemedView>

            {/* ── Cashflow Forecast ── */}
            <ThemedView
              type="backgroundElement"
              style={[styles.card, { borderColor: colors.backgroundSelected }]}
            >
              <View style={styles.cardHeader}>
                <Feather name="bar-chart-2" size={14} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  Proyeksi Arus Kas 6 Bulan
                </Text>
              </View>

              {/* Growth rate input */}
              <View style={styles.growthInputRow}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                  Asumsi growth/bln:
                </Text>
                <TextInput
                  value={growthInput}
                  onChangeText={setGrowthInput}
                  onBlur={() => {
                    const v = parseFloat(growthInput);
                    if (!isNaN(v)) setGrowthRate(v);
                  }}
                  keyboardType="decimal-pad"
                  style={[
                    styles.smallInput,
                    { color: colors.text, borderColor: colors.backgroundSelected },
                  ]}
                />
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>%</Text>
              </View>

              {/* Bar chart */}
              <View style={styles.barChart}>
                {forecastMonths.map((f) => (
                  <View key={f.label} style={styles.barCol}>
                    <Text style={styles.barValue}>
                      {f.value >= 1_000_000
                        ? `${(f.value / 1_000_000).toFixed(1)}jt`
                        : `${(f.value / 1000).toFixed(0)}rb`}
                    </Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            height: `${Math.round((f.value / maxForecast) * 100)}%`,
                            backgroundColor: colors.primary,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.barLabel}>{f.label}</Text>
                  </View>
                ))}
              </View>
            </ThemedView>

            {/* ── PPh UMKM ── */}
            <ThemedView
              type="backgroundElement"
              style={[styles.card, { borderColor: colors.backgroundSelected }]}
            >
              <View style={styles.cardHeader}>
                <Feather name="percent" size={14} color="#f59e0b" />
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  Estimasi Pajak PPh Final UMKM
                </Text>
              </View>
              <Text style={[styles.formula, { color: colors.textSecondary, marginBottom: Spacing.two }]}>
                Sesuai PP 55/2022: 0,5% × Omset Bruto Bulanan
              </Text>
              <View style={styles.pphRow}>
                <View>
                  <Text style={styles.pphLabel}>Omset Bruto Bulan Ini</Text>
                  <Text style={[styles.pphValue, { color: colors.text }]}>
                    Rp{monthlyOmset.toLocaleString('id-ID')}
                  </Text>
                </View>
                <View>
                  <Text style={styles.pphLabel}>Estimasi PPh (0,5%)</Text>
                  <Text style={[styles.pphValue, { color: '#f59e0b' }]}>
                    Rp{pphEstimate.toLocaleString('id-ID')}
                  </Text>
                </View>
              </View>
              <Text style={[styles.pphNote, { color: colors.textSecondary }]}>
                ⚠️ Kewajiban PPh Final berlaku jika omset tahunan melebihi Rp500 juta.
              </Text>
            </ThemedView>

            {/* ── Target Bulanan ── */}
            <ThemedView
              type="backgroundElement"
              style={[styles.card, { borderColor: colors.backgroundSelected }]}
            >
              <View style={styles.cardHeader}>
                <Feather name="target" size={14} color="#22c55e" />
                <Text style={[styles.cardTitle, { color: colors.text }]}>Target Pendapatan Bulanan</Text>
              </View>
              <View style={styles.targetRow}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Rp</Text>
                <TextInput
                  value={targetInput}
                  onChangeText={setTargetInput}
                  onBlur={() => {
                    const v = parseFloat(targetInput.replace(/\D/g, ''));
                    if (!isNaN(v)) setMonthlyTarget(v);
                  }}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  style={[
                    styles.targetInput,
                    { color: colors.text, borderColor: colors.backgroundSelected },
                  ]}
                />
              </View>
              {monthlyTargetIncome > 0 && (
                <View style={styles.targetProgress}>
                  <View
                    style={[styles.progressTrack, { backgroundColor: colors.backgroundSelected }]}
                  >
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.min(100, Math.round((thisMonthIncome / monthlyTargetIncome) * 100))}%`,
                          backgroundColor:
                            thisMonthIncome >= monthlyTargetIncome ? '#22c55e' : colors.primary,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.progressCaption, { color: colors.textSecondary }]}>
                    {Math.min(100, Math.round((thisMonthIncome / monthlyTargetIncome) * 100))}% dari
                    target bulan ini tercapai
                  </Text>
                </View>
              )}

              {/* BEP Per Product list */}
              {products.filter(p => p.isActive && p.sellingPrice > p.hppCalculated).length > 0 && (
                <View style={{ marginTop: Spacing.three, borderTopWidth: 1, borderTopColor: colors.backgroundSelected, paddingTop: Spacing.two }}>
                  <Text style={[styles.inputLabel, { color: colors.text, marginBottom: Spacing.two }]}>
                    Target Penjualan Unit untuk BEP (per produk):
                  </Text>
                  {products.filter(p => p.isActive && p.sellingPrice > p.hppCalculated).map((p) => {
                    const contribution = p.sellingPrice - p.hppCalculated;
                    const unitsNeeded = contribution > 0 ? Math.ceil(monthExpenses / contribution) : 0;
                    const soldUnits = transactions
                      .filter((t) => t.productId === p.id && getMonthKey(t.date) === monthKey)
                      .reduce((sum, t) => sum + t.quantity, 0);
                    const percentage = Math.min(100, Math.round((soldUnits / unitsNeeded) * 100)) || 0;
                    return (
                      <View key={p.id} style={styles.bepProductRow}>
                        <Text style={[styles.bepProductName, { color: colors.text }]}>{p.name}</Text>
                        <Text style={[styles.bepProductDetail, { color: colors.textSecondary }]}>
                          {soldUnits} / {unitsNeeded} {p.unit} ({percentage}%)
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </ThemedView>

            {/* ── CapEx / Investasi ── */}
            <ThemedView
              type="backgroundElement"
              style={[styles.card, { borderColor: colors.backgroundSelected }]}
            >
              <View style={styles.cardHeader}>
                <Feather name="package" size={14} color="#7c3aed" />
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  Anggaran Investasi & Payback Period
                </Text>
                <Pressable
                  onPress={() => setShowCapExForm(!showCapExForm)}
                  style={[styles.addCapExBtn, { backgroundColor: colors.primary }]}
                >
                  <Feather name={showCapExForm ? 'x' : 'plus'} size={12} color="#fff" />
                  <Text style={styles.addCapExBtnText}>{showCapExForm ? 'Batal' : 'Tambah'}</Text>
                </Pressable>
              </View>

              {/* CapEx Form */}
              {showCapExForm && (
                <View style={[styles.capexForm, { borderColor: colors.backgroundSelected }]}>
                  <TextInput
                    value={capexName}
                    onChangeText={setCapexName}
                    placeholder="Nama Investasi (misal: Mesin Kopi)"
                    placeholderTextColor={colors.textSecondary}
                    style={[styles.formInput, { color: colors.text, borderColor: colors.backgroundSelected }]}
                  />
                  <TextInput
                    value={capexAmount}
                    onChangeText={setCapexAmount}
                    placeholder="Nilai Investasi (Rp)"
                    keyboardType="number-pad"
                    placeholderTextColor={colors.textSecondary}
                    style={[styles.formInput, { color: colors.text, borderColor: colors.backgroundSelected }]}
                  />
                  <TextInput
                    value={capexReturn}
                    onChangeText={setCapexReturn}
                    placeholder="Estimasi Keuntungan Bersih per Bulan (Rp)"
                    keyboardType="number-pad"
                    placeholderTextColor={colors.textSecondary}
                    style={[styles.formInput, { color: colors.text, borderColor: colors.backgroundSelected }]}
                  />
                  {/* Category selector */}
                  <View style={styles.catRow}>
                    {CAPEX_CATEGORIES.map((cat) => (
                      <Pressable
                        key={cat}
                        onPress={() => setCapexCategory(cat)}
                        style={[
                          styles.catBtn,
                          capexCategory === cat && { backgroundColor: colors.primary },
                        ]}
                      >
                        <Text
                          style={[
                            styles.catBtnText,
                            { color: capexCategory === cat ? '#fff' : colors.textSecondary },
                          ]}
                        >
                          {cat}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <TextInput
                    value={capexNotes}
                    onChangeText={setCapexNotes}
                    placeholder="Catatan (opsional)"
                    placeholderTextColor={colors.textSecondary}
                    style={[styles.formInput, { color: colors.text, borderColor: colors.backgroundSelected }]}
                  />
                  <Pressable
                    onPress={handleAddCapEx}
                    style={[styles.submitBtn, { backgroundColor: colors.primary }]}
                  >
                    <Text style={styles.submitBtnText}>Simpan Investasi</Text>
                  </Pressable>
                </View>
              )}

              {/* CapEx List */}
              {capexItems.length === 0 ? (
                <Text style={[styles.emptyCapex, { color: colors.textSecondary }]}>
                  Belum ada rencana investasi. Tambahkan untuk menghitung Payback Period.
                </Text>
              ) : (
                capexItems.map((item) => (
                  <View
                    key={item.id}
                    style={[styles.capexRow, { borderColor: colors.backgroundSelected }]}
                  >
                    <View style={styles.capexLeft}>
                      <Text style={[styles.capexName, { color: colors.text }]}>{item.name}</Text>
                      <Text style={styles.capexSub}>
                        {item.category} · Rp{item.investmentAmount.toLocaleString('id-ID')}
                      </Text>
                    </View>
                    <View style={styles.capexRight}>
                      <Text style={[styles.paybackValue, { color: colors.primary }]}>
                        {getPayback(item)}
                      </Text>
                      <Text style={styles.paybackLabel}>payback</Text>
                    </View>
                    <Pressable
                      onPress={() => deleteCapEx(item.id)}
                      style={({ pressed }) => [{ padding: 4 }, pressed && { opacity: 0.5 }]}
                    >
                      <Feather name="trash-2" size={14} color="#ef4444" />
                    </Pressable>
                  </View>
                ))
              )}

              {capexItems.length > 0 && (
                <Text style={[styles.formula, { color: colors.textSecondary, marginTop: Spacing.two }]}>
                  Payback Period = Nilai Investasi ÷ Arus Kas Bersih per Tahun
                </Text>
              )}
            </ThemedView>
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
  card: {
    padding: Spacing.three,
    borderRadius: BorderRadius.medium,
    borderWidth: 1.5,
    marginBottom: Spacing.three,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.three,
  },
  cardTitle: { fontWeight: '800', fontSize: 13, flex: 1 },

  // Growth Rate
  growthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
    gap: Spacing.two,
  },
  growthStat: { flex: 1 },
  growthStatLabel: { fontSize: 10, fontWeight: '700', color: '#9ca3af', marginBottom: 2 },
  growthStatValue: { fontSize: 13, fontWeight: '800' },
  growthBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: BorderRadius.small,
  },
  growthBadgeText: { fontWeight: '800', fontSize: 14 },
  formula: { fontSize: 10, fontWeight: '600', lineHeight: 14 },

  // Bar chart
  growthInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginBottom: Spacing.three,
  },
  inputLabel: { fontSize: 12, fontWeight: '700' },
  smallInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.small,
    paddingHorizontal: Spacing.two,
    paddingVertical: Platform.OS === 'ios' ? 6 : 4,
    width: 60,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 120,
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  barCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barValue: { fontSize: 9, fontWeight: '700', color: '#9ca3af', marginBottom: 2 },
  barTrack: { width: '100%', flex: 1, justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 4, minHeight: 4 },
  barLabel: { fontSize: 9, fontWeight: '600', color: '#9ca3af', marginTop: 4, textAlign: 'center' },

  // PPh
  pphRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  pphLabel: { fontSize: 11, fontWeight: '700', color: '#9ca3af', marginBottom: 2 },
  pphValue: { fontSize: 16, fontWeight: '800' },
  pphNote: { fontSize: 10, fontWeight: '600', lineHeight: 14 },

  // Target
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  targetInput: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: BorderRadius.small,
    paddingHorizontal: Spacing.three,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
    fontWeight: '700',
  },
  targetProgress: { gap: Spacing.one },
  progressTrack: { height: 10, borderRadius: 5, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 5 },
  progressCaption: { fontSize: 11, fontWeight: '600' },

  // CapEx
  addCapExBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: BorderRadius.small,
  },
  addCapExBtnText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  capexForm: {
    borderWidth: 1,
    borderRadius: BorderRadius.small,
    padding: Spacing.two,
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.small,
    paddingHorizontal: Spacing.two,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 13,
  },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  catBtn: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(128,128,128,.1)',
  },
  catBtnText: { fontSize: 11, fontWeight: '700' },
  submitBtn: {
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.small,
    alignItems: 'center',
  },
  submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  emptyCapex: { fontSize: 12, fontWeight: '600', textAlign: 'center', paddingVertical: Spacing.three },
  capexRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderTopWidth: 1,
    gap: Spacing.two,
  },
  capexLeft: { flex: 1 },
  capexName: { fontWeight: '800', fontSize: 13 },
  capexSub: { fontSize: 10, color: '#9ca3af', fontWeight: '600', marginTop: 2 },
  capexRight: { alignItems: 'flex-end' },
  paybackValue: { fontWeight: '800', fontSize: 15 },
  paybackLabel: { fontSize: 10, color: '#9ca3af', fontWeight: '600' },
  bepProductRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  bepProductName: {
    fontSize: 13,
    fontWeight: '700',
  },
  bepProductDetail: {
    fontSize: 12,
    fontWeight: '600',
  },
});
