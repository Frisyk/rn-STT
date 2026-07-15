import React, { useState } from 'react';
import {
  StyleSheet, View, Text, TextInput, Pressable, Platform,
  useColorScheme, ScrollView, KeyboardAvoidingView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing, Colors, BorderRadius } from '@/constants/theme';
import { useProductStore, Product, ProductComponent } from '@/store/productStore';

const PRODUCT_CATEGORIES = ['Makanan', 'Minuman', 'Barang', 'Jasa', 'Lainnya'] as const;
const COMPONENT_UNITS = ['kg', 'gram', 'liter', 'ml', 'butir', 'pcs', 'bungkus', 'paket', 'sdm', 'sdt'] as const;

export default function ProductsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[isDark ? 'dark' : 'light'];
  const { products, addProduct, updateProduct, deleteProduct, addComponent, deleteComponent } = useProductStore();

  // Product form
  const [showForm, setShowForm] = useState(false);
  const [pName, setPName] = useState('');
  const [pCategory, setPCategory] = useState<string>('Makanan');
  const [pPrice, setPPrice] = useState('');
  const [pUnit, setPUnit] = useState('porsi');

  // Component form
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cName, setCName] = useState('');
  const [cQty, setCQty] = useState('');
  const [cUnit, setCUnit] = useState('gram');
  const [cCost, setCCost] = useState('');

  const handleAddProduct = () => {
    if (!pName.trim() || !pPrice) return;
    addProduct({
      name: pName.trim(),
      category: pCategory,
      sellingPrice: parseInt(pPrice.replace(/\D/g, '')) || 0,
      unit: pUnit,
      isActive: true,
    });
    setPName(''); setPPrice(''); setPUnit('porsi'); setPCategory('Makanan');
    setShowForm(false);
  };

  const handleAddComponent = (productId: string) => {
    if (!cName.trim() || !cCost) return;
    addComponent(productId, {
      componentName: cName.trim(),
      quantity: parseFloat(cQty) || 1,
      unit: cUnit,
      costPerUnit: parseInt(cCost.replace(/\D/g, '')) || 0,
    });
    setCName(''); setCQty(''); setCUnit('gram'); setCCost('');
  };

  const confirmDelete = (id: string, name: string) => {
    if (Platform.OS === 'web') {
      if (confirm(`Hapus produk "${name}"?`)) deleteProduct(id);
    } else {
      Alert.alert('Hapus Produk', `Hapus "${name}" beserta semua komponennya?`, [
        { text: 'Batal', style: 'cancel' },
        { text: 'Hapus', style: 'destructive', onPress: () => deleteProduct(id) },
      ]);
    }
  };

  const renderComponent = (comp: ProductComponent, productId: string) => (
    <View key={comp.id} style={[styles.compRow, { borderColor: colors.backgroundSelected }]}>
      <View style={styles.compLeft}>
        <Text style={[styles.compName, { color: colors.text }]}>{comp.componentName}</Text>
        <Text style={styles.compSub}>
          {comp.quantity} {comp.unit} × Rp{comp.costPerUnit.toLocaleString('id-ID')}
        </Text>
      </View>
      <Text style={[styles.compTotal, { color: colors.primary }]}>
        Rp{comp.subtotal.toLocaleString('id-ID')}
      </Text>
      <Pressable onPress={() => deleteComponent(productId, comp.id)}
        style={({ pressed }) => [pressed && { opacity: 0.5 }]}>
        <Feather name="x" size={14} color="#ef4444" />
      </Pressable>
    </View>
  );

  const renderProduct = (product: Product) => {
    const isExpanded = expandedId === product.id;
    return (
      <ThemedView key={product.id} type="backgroundElement"
        style={[styles.productCard, { borderColor: colors.backgroundSelected }]}>
        <Pressable onPress={() => setExpandedId(isExpanded ? null : product.id)}
          style={styles.productHeader}>
          <View style={styles.productInfo}>
            <Text style={[styles.productName, { color: colors.text }]}>{product.name}</Text>
            <Text style={styles.productMeta}>
              {product.category} · {product.unit}
            </Text>
          </View>
          <View style={styles.productPrices}>
            <Text style={[styles.priceMain, { color: colors.text }]}>
              Rp{product.sellingPrice.toLocaleString('id-ID')}
            </Text>
            <Text style={styles.priceSub}>
              HPP: Rp{product.hppCalculated.toLocaleString('id-ID')}
            </Text>
          </View>
          <View style={[styles.marginBadge, {
            backgroundColor: product.marginPercent >= 30 ? 'rgba(34,197,94,.12)' :
              product.marginPercent > 0 ? 'rgba(245,158,11,.12)' : 'rgba(239,68,68,.12)'
          }]}>
            <Text style={[styles.marginText, {
              color: product.marginPercent >= 30 ? '#22c55e' :
                product.marginPercent > 0 ? '#f59e0b' : '#ef4444'
            }]}>
              {product.marginPercent > 0 ? `${product.marginPercent}%` : 'N/A'}
            </Text>
          </View>
          <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
        </Pressable>

        {isExpanded && (
          <View style={styles.expandedSection}>
            {/* Profit info */}
            <View style={[styles.profitRow, { backgroundColor: colors.backgroundSelected }]}>
              <Text style={[styles.profitLabel, { color: colors.textSecondary }]}>
                Laba per {product.unit}
              </Text>
              <Text style={[styles.profitValue, { color: '#22c55e' }]}>
                +Rp{(product.sellingPrice - product.hppCalculated).toLocaleString('id-ID')}
              </Text>
            </View>

            {/* Components list */}
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              Komponen Bahan ({product.components.length})
            </Text>
            {product.components.length === 0 ? (
              <Text style={[styles.emptyComp, { color: colors.textSecondary }]}>
                Belum ada komponen. Tambahkan bahan untuk menghitung HPP otomatis.
              </Text>
            ) : (
              product.components.map((c) => renderComponent(c, product.id))
            )}

            {/* Add component form */}
            <View style={[styles.addCompForm, { borderColor: colors.backgroundSelected }]}>
              <Text style={[styles.formTitle, { color: colors.text }]}>+ Tambah Bahan</Text>
              <TextInput value={cName} onChangeText={setCName} placeholder="Nama bahan (cth: Beras)"
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, { color: colors.text, borderColor: colors.backgroundSelected }]} />
              <View style={styles.rowFields}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Qty</Text>
                  <TextInput value={cQty} onChangeText={setCQty} keyboardType="decimal-pad" placeholder="1"
                    placeholderTextColor={colors.textSecondary}
                    style={[styles.input, { color: colors.text, borderColor: colors.backgroundSelected }]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Satuan</Text>
                  <TextInput value={cUnit} onChangeText={setCUnit} placeholder="gram"
                    placeholderTextColor={colors.textSecondary}
                    style={[styles.input, { color: colors.text, borderColor: colors.backgroundSelected }]} />
                </View>
                <View style={{ flex: 1.5 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Harga/Unit</Text>
                  <TextInput value={cCost} onChangeText={setCCost} keyboardType="number-pad" placeholder="0"
                    placeholderTextColor={colors.textSecondary}
                    style={[styles.input, { color: colors.text, borderColor: colors.backgroundSelected }]} />
                </View>
              </View>
              <Pressable onPress={() => handleAddComponent(product.id)}
                style={[styles.addCompBtn, { backgroundColor: colors.primary }]}>
                <Text style={styles.addCompBtnText}>Simpan Bahan</Text>
              </Pressable>
            </View>

            {/* Actions */}
            <View style={styles.productActions}>
              <Pressable onPress={() => confirmDelete(product.id, product.name)}
                style={[styles.deleteBtn]}>
                <Feather name="trash-2" size={14} color="#ef4444" />
                <Text style={styles.deleteBtnText}>Hapus Produk</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ThemedView>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: BottomTabInset + 80 }]}
            keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerRow}>
                <View>
                  <ThemedText type="title">Katalog Produk</ThemedText>
                  <ThemedText themeColor="textSecondary">Kelola produk, resep, dan harga jual</ThemedText>
                </View>
                <Pressable onPress={() => setShowForm(!showForm)}
                  style={[styles.headerBtn, { backgroundColor: colors.primary }]}>
                  <Feather name={showForm ? 'x' : 'plus'} size={14} color="#fff" />
                  <Text style={styles.headerBtnText}>{showForm ? 'Batal' : 'Produk Baru'}</Text>
                </Pressable>
              </View>
            </View>

            {/* New Product Form */}
            {showForm && (
              <ThemedView type="backgroundElement"
                style={[styles.newProductForm, { borderColor: colors.backgroundSelected }]}>
                <Text style={[styles.formTitle, { color: colors.text }]}>Produk Baru</Text>

                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Nama Produk</Text>
                <TextInput value={pName} onChangeText={setPName}
                  placeholder="cth: Nasi Goreng Spesial"
                  placeholderTextColor={colors.textSecondary}
                  style={[styles.input, { color: colors.text, borderColor: colors.backgroundSelected }]} />

                <View style={styles.rowFields}>
                  <View style={{ flex: 2 }}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Harga Jual (Rp)</Text>
                    <TextInput value={pPrice} onChangeText={setPPrice} keyboardType="number-pad"
                      placeholder="15000"
                      placeholderTextColor={colors.textSecondary}
                      style={[styles.input, { color: colors.text, borderColor: colors.backgroundSelected }]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Satuan</Text>
                    <TextInput value={pUnit} onChangeText={setPUnit} placeholder="porsi"
                      placeholderTextColor={colors.textSecondary}
                      style={[styles.input, { color: colors.text, borderColor: colors.backgroundSelected }]} />
                  </View>
                </View>

                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Kategori</Text>
                <View style={styles.catRow}>
                  {PRODUCT_CATEGORIES.map((cat) => (
                    <Pressable key={cat} onPress={() => setPCategory(cat)}
                      style={[styles.catBtn, pCategory === cat && { backgroundColor: colors.primary },
                        pCategory !== cat && { backgroundColor: colors.backgroundSelected }]}>
                      <Text style={[styles.catBtnText,
                        { color: pCategory === cat ? '#fff' : colors.textSecondary }]}>{cat}</Text>
                    </Pressable>
                  ))}
                </View>

                <Pressable onPress={handleAddProduct}
                  disabled={!pName.trim()}
                  style={[styles.submitBtn, {
                    backgroundColor: pName.trim() ? colors.primary : colors.backgroundSelected
                  }]}>
                  <Text style={[styles.submitBtnText,
                    { color: pName.trim() ? '#fff' : colors.textSecondary }]}>Simpan Produk</Text>
                </Pressable>
              </ThemedView>
            )}

            {/* Products List */}
            {products.length === 0 ? (
              <ThemedView type="backgroundElement"
                style={[styles.emptyCard, { borderColor: colors.backgroundSelected }]}>
                <Feather name="package" size={40} color={colors.textSecondary} style={{ opacity: 0.4, marginBottom: 10 }} />
                <ThemedText themeColor="textSecondary" style={{ textAlign: 'center' }}>
                  Belum ada produk. Tambahkan produk pertama Anda untuk mulai menghitung HPP otomatis.
                </ThemedText>
              </ThemedView>
            ) : (
              products.map(renderProduct)
            )}

            {/* Guide Card */}
            <ThemedView type="backgroundElement"
              style={[styles.guideCard, { borderColor: colors.backgroundSelected }]}>
              <View style={styles.cardHeader}>
                <Feather name="info" size={14} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>Cara Kerja</Text>
              </View>
              <Text style={[styles.guideText, { color: colors.textSecondary }]}>
                1. Buat produk (misal: Nasi Goreng) dengan harga jual{'\n'}
                2. Tambahkan komponen bahan (beras, telur, minyak, dll){'\n'}
                3. HPP dan margin otomatis dihitung{'\n'}
                4. Saat mencatat penjualan di tab Transaksi, pilih dari katalog — semua data terisi otomatis
              </Text>
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.three, paddingVertical: 8,
    borderRadius: BorderRadius.full,
  },
  headerBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },

  // New product form
  newProductForm: {
    padding: Spacing.three, borderRadius: BorderRadius.medium,
    borderWidth: 1.5, marginBottom: Spacing.three, gap: Spacing.one,
  },
  formTitle: { fontWeight: '800', fontSize: 14, marginBottom: Spacing.one },
  fieldLabel: { fontSize: 11, fontWeight: '700', marginBottom: Spacing.one, marginTop: Spacing.one },
  input: {
    borderWidth: 1.5, borderRadius: BorderRadius.small,
    paddingHorizontal: Spacing.two,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 14, fontWeight: '600',
  },
  rowFields: { flexDirection: 'row', gap: Spacing.two },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one, marginBottom: Spacing.two },
  catBtn: { paddingHorizontal: Spacing.two, paddingVertical: 4, borderRadius: BorderRadius.full },
  catBtnText: { fontSize: 11, fontWeight: '700' },
  submitBtn: {
    paddingVertical: Spacing.two + 4, borderRadius: BorderRadius.medium,
    alignItems: 'center', marginTop: Spacing.two,
  },
  submitBtnText: { fontWeight: '800', fontSize: 14 },

  // Product card
  productCard: {
    borderRadius: BorderRadius.medium, borderWidth: 1.5,
    marginBottom: Spacing.two, overflow: 'hidden',
  },
  productHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.two,
    padding: Spacing.three,
  },
  productInfo: { flex: 1 },
  productName: { fontWeight: '800', fontSize: 14 },
  productMeta: { fontSize: 10, color: '#9ca3af', fontWeight: '600', marginTop: 2 },
  productPrices: { alignItems: 'flex-end' },
  priceMain: { fontWeight: '800', fontSize: 13 },
  priceSub: { fontSize: 10, color: '#9ca3af', fontWeight: '600', marginTop: 1 },
  marginBadge: {
    paddingHorizontal: Spacing.two, paddingVertical: 3, borderRadius: BorderRadius.small,
  },
  marginText: { fontWeight: '800', fontSize: 12 },

  // Expanded section
  expandedSection: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.three },
  profitRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.two, borderRadius: BorderRadius.small, marginBottom: Spacing.two,
  },
  profitLabel: { fontSize: 12, fontWeight: '700' },
  profitValue: { fontSize: 16, fontWeight: '800' },
  sectionLabel: { fontSize: 11, fontWeight: '700', marginBottom: Spacing.one, marginTop: Spacing.one },
  emptyComp: { fontSize: 12, fontWeight: '600', textAlign: 'center', paddingVertical: Spacing.two },

  // Component row
  compRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.two,
    paddingVertical: Spacing.one + 2, borderBottomWidth: 1,
  },
  compLeft: { flex: 1 },
  compName: { fontWeight: '700', fontSize: 12 },
  compSub: { fontSize: 10, color: '#9ca3af', fontWeight: '600' },
  compTotal: { fontWeight: '800', fontSize: 12 },

  // Add component form
  addCompForm: {
    borderWidth: 1, borderRadius: BorderRadius.small, borderStyle: 'dashed',
    padding: Spacing.two, marginTop: Spacing.two, gap: Spacing.one,
  },
  addCompBtn: {
    paddingVertical: Spacing.two, borderRadius: BorderRadius.small,
    alignItems: 'center', marginTop: Spacing.one,
  },
  addCompBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },

  // Product actions
  productActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: Spacing.two },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: Spacing.one },
  deleteBtnText: { color: '#ef4444', fontWeight: '700', fontSize: 12 },

  // Empty & guide
  emptyCard: {
    padding: Spacing.five, borderRadius: BorderRadius.medium, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.three,
  },
  guideCard: {
    padding: Spacing.three, borderRadius: BorderRadius.medium, borderWidth: 1.5,
    marginBottom: Spacing.three,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.two },
  cardTitle: { fontWeight: '800', fontSize: 13 },
  guideText: { fontSize: 12, fontWeight: '600', lineHeight: 20 },
});
