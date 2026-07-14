import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  FlatList,
  Platform,
  useColorScheme,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing, Colors, BorderRadius } from '@/constants/theme';
import { useTransactionStore, Transaction, getMonthKey } from '@/store/transactionStore';

type PeriodFilter = 'hari_ini' | 'bulan_ini' | 'semua';

export default function PastScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[isDark ? 'dark' : 'light'];

  const { transactions, isSyncing, syncTransactions, clearTransactions, deleteTransaction } =
    useTransactionStore();

  const [period, setPeriod] = useState<PeriodFilter>('bulan_ini');

  // ── Filter by period ──────────────────────────────────────────────────────────
  const filteredTx = useMemo(() => {
    const now = new Date();
    const todayKey = now.toISOString().substring(0, 10);
    const monthKey = getMonthKey(now.toISOString());

    return transactions.filter((t) => {
      if (period === 'hari_ini') return t.date.substring(0, 10) === todayKey;
      if (period === 'bulan_ini') return getMonthKey(t.date) === monthKey;
      return true;
    });
  }, [transactions, period]);

  // ── P&L Calculations ─────────────────────────────────────────────────────────
  const { pendapatanPenjualan, totalHPP, labaKotor, biayaOperasional, labaBersih } =
    useMemo(() => {
      const sales = filteredTx.filter((t) => t.type === 'pemasukan');
      const expenses = filteredTx.filter((t) => t.type === 'pengeluaran');

      const pendapatanPenjualan = sales.reduce((s, t) => s + t.total, 0);
      const totalHPP = sales.reduce((s, t) => s + t.hpp * t.quantity, 0);
      const labaKotor = pendapatanPenjualan - totalHPP;
      const biayaOperasional = expenses.reduce((s, t) => s + t.total + t.operasionalCost, 0);
      const labaBersih = labaKotor - biayaOperasional;

      return { pendapatanPenjualan, totalHPP, labaKotor, biayaOperasional, labaBersih };
    }, [filteredTx]);

  const unsyncedCount = transactions.filter((t) => !t.synced).length;

  // ── CSV Export ───────────────────────────────────────────────────────────────
  const handleExportCSV = async () => {
    if (filteredTx.length === 0) return;

    const headers =
      'ID,Tanggal,Tipe,Nama,Kategori,Qty,Harga,HPP,Total,Laba,Sinkron\n';
    const rows = filteredTx
      .map((t) => {
        const date = new Date(t.date).toLocaleDateString('id-ID');
        return `"${t.id}","${date}","${t.type}","${t.name.replace(/"/g, '""')}","${t.category}",${t.quantity},${t.price},${t.hpp},${t.total},${t.profit},"${t.synced ? 'Ya' : 'Tidak'}"`;
      })
      .join('\n');
    const csv = headers + rows;

    if (Platform.OS === 'web') {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `laporan_kas_${period}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const FileSystem = require('expo-file-system/legacy');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Sharing = require('expo-sharing');
        const uri = FileSystem.documentDirectory + 'laporan_kas.csv';
        await FileSystem.writeAsStringAsync(uri, csv, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'text/csv' });
        }
      } catch (e) {
        console.error('CSV export error:', e);
      }
    }
  };

  // ── Render helpers ───────────────────────────────────────────────────────────
  const PeriodButton = ({ id, label }: { id: PeriodFilter; label: string }) => (
    <Pressable
      onPress={() => setPeriod(id)}
      style={[
        styles.periodBtn,
        period === id && { backgroundColor: colors.primary },
      ]}
    >
      <Text
        style={[
          styles.periodBtnText,
          { color: period === id ? '#fff' : colors.textSecondary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );

  const renderPLRow = (label: string, value: number, bold = false, highlight?: string) => (
    <View style={styles.plRow}>
      <Text style={[styles.plLabel, bold && { fontWeight: '800' }, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <Text
        style={[
          styles.plValue,
          bold && { fontWeight: '800', fontSize: 15 },
          { color: highlight ?? colors.text },
        ]}
      >
        Rp{Math.abs(value).toLocaleString('id-ID')}
      </Text>
    </View>
  );

  const renderTableRow = ({ item }: { item: Transaction }) => {
    const isIncome = item.type === 'pemasukan';
    return (
      <View style={[styles.tableRow, { borderColor: colors.backgroundSelected }]}>
        <View style={styles.colProduct}>
          <Text style={[styles.cellBold, { color: colors.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.cellSub}>{item.category}</Text>
        </View>
        <View style={styles.colQty}>
          <Text style={[styles.cellText, { color: colors.text }]}>{item.quantity}×</Text>
          <Text style={styles.cellSub}>@{item.price.toLocaleString('id-ID')}</Text>
        </View>
        <View style={styles.colTotal}>
          <Text style={[styles.cellBold, { color: isIncome ? '#22c55e' : '#ef4444' }]}>
            {isIncome ? '+' : '−'}Rp{item.total.toLocaleString('id-ID')}
          </Text>
          {isIncome && item.hpp > 0 && (
            <Text style={[styles.cellSub, { color: '#22c55e' }]}>
              Laba +{(item.total - item.hpp * item.quantity).toLocaleString('id-ID')}
            </Text>
          )}
        </View>
        <View style={styles.colStatus}>
          <View
            style={[
              styles.badge,
              { backgroundColor: item.synced ? 'rgba(34,197,94,.12)' : 'rgba(234,88,12,.12)' },
            ]}
          >
            <Feather
              name={item.synced ? 'cloud' : 'database'}
              size={9}
              color={item.synced ? '#22c55e' : '#ea580c'}
            />
            <Text style={[styles.badgeText, { color: item.synced ? '#22c55e' : '#ea580c' }]}>
              {item.synced ? 'Awan' : 'Lokal'}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => deleteTransaction(item.id)}
          style={({ pressed }) => [styles.colAction, pressed && { opacity: 0.5 }]}
        >
          <Feather name="trash-2" size={15} color="#ef4444" />
        </Pressable>
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <ThemedText type="title">Laporan Laba Rugi</ThemedText>
              <ThemedText themeColor="textSecondary">Evaluasi historis bisnis Anda</ThemedText>
            </View>
            {unsyncedCount > 0 && (
              <Pressable
                onPress={syncTransactions}
                disabled={isSyncing}
                style={[styles.syncBtn, { backgroundColor: colors.primary }]}
              >
                {isSyncing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Feather name="refresh-cw" size={10} color="#fff" />
                    <Text style={styles.syncBtnText}>Sync {unsyncedCount}</Text>
                  </>
                )}
              </Pressable>
            )}
          </View>

          {/* Period filter */}
          <View style={styles.periodRow}>
            <PeriodButton id="hari_ini" label="Hari Ini" />
            <PeriodButton id="bulan_ini" label="Bulan Ini" />
            <PeriodButton id="semua" label="Semua" />
          </View>
        </View>

        <FlatList
          data={filteredTx}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: BottomTabInset + Spacing.four }]}
          ListHeaderComponent={
            <>
              {/* ── P&L Statement ── */}
              <ThemedView
                type="backgroundElement"
                style={[styles.plCard, { borderColor: colors.backgroundSelected }]}
              >
                <View style={styles.plCardHeader}>
                  <Feather name="file-text" size={14} color={colors.primary} />
                  <Text style={[styles.plCardTitle, { color: colors.text }]}>
                    Laporan Laba Rugi (P&L)
                  </Text>
                </View>
                <View style={styles.plDivider} />
                {renderPLRow('(+) Pendapatan Penjualan', pendapatanPenjualan)}
                {renderPLRow('(−) HPP Total', totalHPP)}
                <View style={[styles.plDivider, { marginVertical: 4 }]} />
                {renderPLRow('= Laba Kotor', labaKotor, true, labaKotor >= 0 ? '#22c55e' : '#ef4444')}
                {renderPLRow('(−) Biaya Operasional', biayaOperasional)}
                <View style={styles.plDividerBold} />
                {renderPLRow(
                  '= LABA BERSIH',
                  labaBersih,
                  true,
                  labaBersih >= 0 ? '#7c3aed' : '#ef4444'
                )}
              </ThemedView>

              {/* ── Action Toolbar ── */}
              {filteredTx.length > 0 && (
                <View style={styles.toolbar}>
                  <Pressable
                    onPress={handleExportCSV}
                    style={({ pressed }) => [
                      styles.exportBtn,
                      { backgroundColor: colors.accent },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Feather name="download" size={13} color={isDark ? '#000' : '#fff'} />
                    <Text style={[styles.exportBtnText, { color: isDark ? '#000' : '#fff' }]}>
                      Ekspor CSV
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={clearTransactions}
                    style={({ pressed }) => [pressed && { opacity: 0.7 }]}
                  >
                    <Text style={styles.clearBtnText}>Hapus Semua</Text>
                  </Pressable>
                </View>
              )}

              {/* ── Table Header ── */}
              {filteredTx.length > 0 && (
                <View style={[styles.tableHeader, { backgroundColor: colors.backgroundSelected }]}>
                  <Text style={[styles.thCell, styles.colProduct, { color: colors.text }]}>
                    Item & Kategori
                  </Text>
                  <Text style={[styles.thCell, styles.colQty, { color: colors.text }]}>Qty</Text>
                  <Text style={[styles.thCell, styles.colTotal, { color: colors.text }]}>Jumlah</Text>
                  <Text style={[styles.thCell, styles.colStatus, { color: colors.text }]}>Status</Text>
                  <View style={styles.colAction} />
                </View>
              )}
            </>
          }
          renderItem={renderTableRow}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="inbox" size={40} color={colors.textSecondary} style={{ opacity: 0.4, marginBottom: 10 }} />
              <ThemedText themeColor="textSecondary">Belum ada transaksi pada periode ini.</ThemedText>
            </View>
          }
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth },
  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Platform.OS === 'web' ? 88 : Spacing.three,
    paddingBottom: Spacing.two,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.three },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  syncBtnText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  periodRow: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.two },
  periodBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: 'transparent',
  },
  periodBtnText: { fontSize: 12, fontWeight: '700' },
  list: { paddingHorizontal: Spacing.four },

  // P&L Card
  plCard: {
    padding: Spacing.three,
    borderRadius: BorderRadius.medium,
    borderWidth: 1.5,
    marginBottom: Spacing.three,
  },
  plCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.two },
  plCardTitle: { fontWeight: '800', fontSize: 13 },
  plRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  plLabel: { fontSize: 13, flex: 1 },
  plValue: { fontSize: 13, fontWeight: '700' },
  plDivider: { height: 1, backgroundColor: 'rgba(128,128,128,.15)', marginVertical: 2 },
  plDividerBold: { height: 2, backgroundColor: 'rgba(128,128,128,.3)', marginVertical: 6 },

  // Toolbar
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.small,
  },
  exportBtnText: { fontWeight: '800', fontSize: 12 },
  clearBtnText: { color: '#ef4444', fontWeight: '700', fontSize: 12 },

  // Table
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: BorderRadius.small,
    marginBottom: Spacing.one,
  },
  thCell: { fontWeight: '800', fontSize: 11 },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.two,
    borderBottomWidth: 1,
  },
  cellBold: { fontSize: 13, fontWeight: '800' },
  cellText: { fontSize: 13, fontWeight: '600' },
  cellSub: { fontSize: 10, color: '#9ca3af', marginTop: 2, fontWeight: '600' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: Spacing.one,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: { fontSize: 9, fontWeight: '800' },

  // Column widths
  colProduct: { flex: 3, paddingRight: Spacing.one },
  colQty: { flex: 1.8, paddingRight: Spacing.one },
  colTotal: { flex: 3.5, paddingRight: Spacing.one },
  colStatus: { flex: 2 },
  colAction: { flex: 0.8, alignItems: 'center', justifyContent: 'center' },

  empty: { paddingVertical: 40, alignItems: 'center', gap: 4 },
});
