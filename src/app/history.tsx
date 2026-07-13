import React from 'react';
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

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing, Colors, BorderRadius } from '@/constants/theme';
import { useTransactionStore, Transaction } from '@/store/transactionStore';
// eslint-disable-next-line import/no-unresolved
import { Feather } from '@expo/vector-icons';

export default function HistoryScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[isDark ? 'dark' : 'light'];

  const {
    transactions,
    isSyncing,
    deleteTransaction,
    syncTransactions,
    clearTransactions,
  } = useTransactionStore();

  const unsyncedCount = transactions.filter((t) => !t.synced).length;

  const handleExportCSV = async () => {
    if (transactions.length === 0) return;

    // Generate CSV string
    const headers = 'ID,Tanggal,Nama Produk,Kategori,Jumlah,Harga Satuan,Total,Status Sinkron\n';
    const rows = transactions
      .map((t) => {
        const formattedDate = new Date(t.date).toLocaleDateString('id-ID');
        const escapedName = t.name.replace(/"/g, '""');
        const syncStatus = t.synced ? 'Tersinkron' : 'Lokal';
        return `"${t.id}","${formattedDate}","${escapedName}","${t.category}",${t.quantity},${t.price},${t.total},"${syncStatus}"`;
      })
      .join('\n');
    const csvContent = headers + rows;

    if (Platform.OS === 'web') {
      // Browser CSV Download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', 'riwayat_transaksi_umkm.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // Mobile / Native File Sharing
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const FileSystem = require('expo-file-system/legacy');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Sharing = require('expo-sharing');

        const fileUri = FileSystem.documentDirectory + 'riwayat_transaksi_umkm.csv';
        await FileSystem.writeAsStringAsync(fileUri, csvContent, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'text/csv',
            dialogTitle: 'Ekspor Data Transaksi',
            UTI: 'public.comma-separated-values-text',
          });
        } else {
          alert('Berbagi file tidak didukung di perangkat ini.');
        }
      } catch (e) {
        console.error('Error exporting CSV:', e);
        alert('Gagal mengekspor file CSV.');
      }
    }
  };

  const renderTableHeader = () => (
    <View style={[styles.tableHeader, { backgroundColor: colors.backgroundSelected }]}>
      <Text style={[styles.headerCell, styles.colProduct, { color: colors.text }]}>Produk</Text>
      <Text style={[styles.headerCell, styles.colQty, { color: colors.text }]}>Qty</Text>
      <Text style={[styles.headerCell, styles.colTotal, { color: colors.text }]}>Total</Text>
      <Text style={[styles.headerCell, styles.colStatus, { color: colors.text }]}>Status</Text>
      <Text style={[styles.headerCell, styles.colAction, { color: colors.text }]}></Text>
    </View>
  );

  const renderTableRow = ({ item }: { item: Transaction }) => {
    return (
      <View style={[styles.tableRow, { borderColor: colors.backgroundSelected }]}>
        {/* Product Column */}
        <View style={styles.colProduct}>
          <Text style={[styles.cellTextBold, { color: colors.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.cellTextSub}>{item.category}</Text>
        </View>

        {/* Qty Column */}
        <View style={styles.colQty}>
          <Text style={[styles.cellText, { color: colors.text }]}>{item.quantity}x</Text>
          <Text style={styles.cellTextSub}>@{item.price.toLocaleString('id-ID')}</Text>
        </View>

        {/* Total Column */}
        <View style={styles.colTotal}>
          <Text style={[styles.cellTextBold, { color: colors.primary }]}>
            Rp{item.total.toLocaleString('id-ID')}
          </Text>
          <Text style={styles.cellTextSub}>
            {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>

        {/* Status Column */}
        <View style={styles.colStatus}>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: item.synced ? 'rgba(34, 197, 94, 0.1)' : 'rgba(234, 88, 12, 0.1)' },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Feather name={item.synced ? "cloud" : "database"} size={10} color={item.synced ? '#22c55e' : '#ea580c'} />
              <Text style={[styles.statusText, { color: item.synced ? '#22c55e' : '#ea580c' }]}>
                {item.synced ? 'Awan' : 'Lokal'}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Column (Delete) */}
        <Pressable
          onPress={() => deleteTransaction(item.id)}
          style={({ pressed }) => [styles.colAction, pressed && styles.buttonPressed]}
        >
          <Feather name="trash-2" size={16} color="#ef4444" />
        </Pressable>
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* Header Block */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
              <ThemedText type="title">Riwayat Transaksi</ThemedText>
              <Feather name="list" size={24} color={colors.primary} />
            </View>
            {unsyncedCount > 0 && (
              <Pressable
                onPress={syncTransactions}
                disabled={isSyncing}
                style={({ pressed }) => [
                  styles.smallSyncBtn,
                  { backgroundColor: colors.primary },
                  pressed && styles.buttonPressed,
                ]}
              >
                {isSyncing ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Feather name="refresh-cw" size={10} color="#ffffff" />
                    <Text style={styles.smallSyncBtnText}>Sync</Text>
                  </View>
                )}
              </Pressable>
            )}
          </View>
          <ThemedText themeColor="textSecondary">
            {unsyncedCount > 0
              ? `Terdapat ${unsyncedCount} transaksi lokal yang belum disinkronkan.`
              : 'Semua data transaksi lokal Anda tersimpan dengan aman.'}
          </ThemedText>
        </View>

        {/* Action Toolbar */}
        {transactions.length > 0 && (
          <View style={styles.toolbar}>
            <Pressable
              onPress={handleExportCSV}
              style={({ pressed }) => [
                styles.exportBtn,
                { backgroundColor: colors.accent },
                pressed && styles.buttonPressed,
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Feather name="download" size={14} color="#ffffff" />
                <Text style={styles.exportBtnText}>Ekspor ke CSV</Text>
              </View>
            </Pressable>

            <Pressable
              onPress={clearTransactions}
              style={({ pressed }) => [styles.clearBtn, pressed && styles.buttonPressed]}
            >
              <Text style={styles.clearBtnText}>Bersihkan Semua</Text>
            </Pressable>
          </View>
        )}

        {/* Structured Table Listing */}
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={transactions.length > 0 ? renderTableHeader : null}
          renderItem={renderTableRow}
          contentContainerStyle={[
            styles.listContainer,
            { paddingBottom: BottomTabInset + Spacing.four },
          ]}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="inbox" size={48} color={colors.textSecondary} style={{ opacity: 0.5, marginBottom: 12 }} />
              <ThemedText type="subtitle" style={styles.emptyText}>
                Belum ada transaksi
              </ThemedText>
              <ThemedText themeColor="textSecondary">
                Silakan catat penjualan Anda di menu Catat terlebih dahulu.
              </ThemedText>
            </View>
          }
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Platform.OS === 'web' ? 88 : Spacing.three,
    paddingBottom: Spacing.two,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  smallSyncBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  smallSyncBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 12,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.three,
  },
  exportBtn: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.medium,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exportBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
  },
  clearBtn: {
    paddingVertical: Spacing.two,
  },
  clearBtnText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '700',
  },
  listContainer: {
    paddingHorizontal: Spacing.four,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: BorderRadius.small,
    marginBottom: Spacing.one,
  },
  headerCell: {
    fontWeight: '800',
    fontSize: 12,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: 1.5,
  },
  cellText: {
    fontSize: 13,
    fontWeight: '600',
  },
  cellTextBold: {
    fontSize: 13,
    fontWeight: '800',
  },
  cellTextSub: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 2,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: BorderRadius.small,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  deleteText: {
    fontSize: 14,
    textAlign: 'center',
  },
  // Responsive Columns Flex
  colProduct: {
    flex: 3.5,
    paddingRight: Spacing.one,
  },
  colQty: {
    flex: 2,
    paddingRight: Spacing.one,
  },
  colTotal: {
    flex: 3,
    paddingRight: Spacing.one,
  },
  colStatus: {
    flex: 2.2,
    alignItems: 'flex-start',
  },
  colAction: {
    flex: 0.8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  emptyContainer: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.two,
    opacity: 0.5,
  },
  emptyText: {
    fontWeight: 'bold',
    marginBottom: Spacing.one,
  },
});
