import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  Platform,
  useColorScheme,
  ScrollView,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing, Colors, BorderRadius } from '@/constants/theme';
import { useTransactionStore, getMonthKey } from '@/store/transactionStore';
import { useStockStore } from '@/store/stockStore';
import { useProductStore, Product } from '@/store/productStore';
import { useAuthStore } from '@/store/authStore';

// ── Web Speech Recognition ───────────────────────────────────────────────────
let recognition: any = null;
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'id-ID';
    recognition.interimResults = false;
  }
}

// ── Categories ───────────────────────────────────────────────────────────────
const PEMASUKAN_CATEGORIES = ['Makanan', 'Minuman', 'Barang', 'Jasa', 'Lainnya'] as const;
const PENGELUARAN_CATEGORIES = ['Bahan Baku', 'Operasional', 'Sewa', 'Gaji', 'Lainnya'] as const;

// ── NLP Parser ───────────────────────────────────────────────────────────────
const parseVoiceText = (text: string) => {
  const lowercase = text.toLowerCase();
  const expenseKeywords = ['beli', 'belanja', 'bayar', 'sewa', 'gaji', 'utilitas', 'operasional', 'pengeluaran', 'keluar'];
  const isExpense = expenseKeywords.some((kw) => lowercase.includes(kw));
  const type: 'pemasukan' | 'pengeluaran' = isExpense ? 'pengeluaran' : 'pemasukan';

  const numberWords: { [key: string]: number } = {
    satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10,
  };

  let qty = 1;
  const qtyRegex = /(?:(\d+)|(satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh))\s*(porsi|gelas|pax|buah|biji|pcs|ikat|piring|mangkuk|kg|bungkus|liter|karung|jasa|orang)/i;
  const qtyMatch = lowercase.match(qtyRegex);
  if (qtyMatch) {
    if (qtyMatch[1]) qty = parseInt(qtyMatch[1]);
    else if (qtyMatch[2]) qty = numberWords[qtyMatch[2]];
  }

  let cleanedText = lowercase;
  const wordToNumMap: [RegExp, string][] = [
    [/sebelas/g, '11'], [/dua\s*belas/g, '12'], [/tiga\s*belas/g, '13'],
    [/empat\s*belas/g, '14'], [/lima\s*belas/g, '15'], [/enam\s*belas/g, '16'],
    [/tujuh\s*belas/g, '17'], [/delapan\s*belas/g, '18'], [/sembilan\s*belas/g, '19'],
    [/sepuluh/g, '10'], [/dua\s*puluh/g, '20'], [/tiga\s*puluh/g, '30'],
    [/empat\s*puluh/g, '40'], [/lima\s*puluh/g, '50'], [/enam\s*puluh/g, '60'],
    [/tujuh\s*puluh/g, '70'], [/delapan\s*puluh/g, '80'], [/sembilan\s*puluh/g, '90'],
    [/satu/g, '1'], [/dua/g, '2'], [/tiga/g, '3'], [/empat/g, '4'], [/lima/g, '5'],
    [/enam/g, '6'], [/tujuh/g, '7'], [/delapan/g, '8'], [/sembilan/g, '9'],
  ];
  wordToNumMap.forEach(([r, rep]) => { cleanedText = cleanedText.replace(r, rep); });

  let price = 0;
  const tm = cleanedText.match(/(\d+)\s*ribu/i);
  const mm = cleanedText.match(/(\d+)\s*juta/i);
  const hm = cleanedText.match(/(\d+)\s*ratus/i);
  const rm = cleanedText.match(/(\d{4,})/i);
  if (tm) price = parseInt(tm[1]) * 1000;
  else if (mm) price = parseInt(mm[1]) * 1_000_000;
  else if (hm) price = parseInt(hm[1]) * 100;
  else if (rm) price = parseInt(rm[1]);

  let hpp = 0;
  if (type === 'pemasukan') {
    const modalMatch = cleanedText.match(/(?:modal|pokok|beli)\s*(?:sebesar)?\s*(\d+)\s*(ribu|juta)?/i);
    if (modalMatch) {
      const base = parseInt(modalMatch[1]);
      const unit = modalMatch[2]?.toLowerCase() ?? '';
      hpp = unit === 'ribu' ? base * 1000 : unit === 'juta' ? base * 1_000_000 : base;
    }
  }

  let name = lowercase;
  name = name.replace(/(?:harga|seharga|total|bayar|nominal|rupiah)/gi, '');
  name = name.replace(/(?:porsi|gelas|pax|buah|biji|pcs|ikat|piring|mangkuk|kg|bungkus|liter|karung|jasa|orang)/gi, '');
  name = name.replace(/(?:modal|pokok|beli)\s*(?:sebesar)?\s*\d+\s*(?:ribu|juta)?/gi, '');
  Object.keys(numberWords).forEach((w) => { name = name.replace(new RegExp('\\b' + w + '\\b', 'gi'), ''); });
  name = name.replace(/\d+/g, '').replace(/\b(?:beli|pesan|catat|tambah|ada|transaksi|jual|laku|belanja|gaji|sewa|bayar)\b/gi, '');
  name = name.replace(/\s+/g, ' ').trim();
  name = name ? name.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : (type === 'pemasukan' ? 'Penjualan Baru' : 'Belanja Baru');

  let category = 'Lainnya';
  const lp = name.toLowerCase();
  if (type === 'pemasukan') {
    if (['nasi', 'goreng', 'mie', 'bakso', 'sate', 'roti', 'ayam', 'ikan', 'makan', 'soto'].some((k) => lp.includes(k))) category = 'Makanan';
    else if (['kopi', 'teh', 'susu', 'jus', 'es', 'boba', 'air', 'sirup'].some((k) => lp.includes(k))) category = 'Minuman';
    else if (['potong', 'cukur', 'salon', 'servis', 'jasa', 'cuci'].some((k) => lp.includes(k))) category = 'Jasa';
    else if (['sabun', 'beras', 'telur', 'minyak', 'buku', 'baju', 'kaos'].some((k) => lp.includes(k))) category = 'Barang';
  } else {
    if (['beras', 'minyak', 'telur', 'daging', 'sayur', 'kopi', 'gula', 'tepung', 'bumbu'].some((k) => lp.includes(k))) category = 'Bahan Baku';
    else if (['sewa', 'kontrak', 'ruko', 'kios'].some((k) => lp.includes(k))) category = 'Sewa';
    else if (['gaji', 'karyawan', 'upah', 'staf'].some((k) => lp.includes(k))) category = 'Gaji';
    else if (['listrik', 'air', 'internet', 'pulsa', 'gas'].some((k) => lp.includes(k))) category = 'Operasional';
  }

  return { type, name, quantity: qty, price, hpp, category };
};

// ── Screen Component ──────────────────────────────────────────────────────────
export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[isDark ? 'dark' : 'light'];

  const { transactions, addTransaction } = useTransactionStore();
  const { stocks, decreaseStock, increaseStock } = useStockStore();
  const { products } = useProductStore();
  const { userProfile } = useAuthStore();

  // STT
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [sttError, setSttError] = useState<string | null>(null);

  // Form
  const [type, setType] = useState<'pemasukan' | 'pengeluaran'>('pemasukan');
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('0');
  const [hpp, setHpp] = useState('0');
  const [operasionalCost, setOperasionalCost] = useState('0');
  const [category, setCategory] = useState<string>('Lainnya');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  // ── Today's summary ──────────────────────────────────────────────────────────
  const todayKey = new Date().toISOString().substring(0, 10);
  const todayTx = transactions.filter((t) => t.date.substring(0, 10) === todayKey);
  const todayOmset = todayTx.filter((t) => t.type === 'pemasukan').reduce((s, t) => s + t.total, 0);
  const todayBelanja = todayTx.filter((t) => t.type === 'pengeluaran').reduce((s, t) => s + t.total, 0);
  const todayLaba = todayTx.reduce((s, t) => s + t.profit, 0);

  // ── BEP ──────────────────────────────────────────────────────────────────────
  const monthKey = getMonthKey(new Date().toISOString());
  const monthExpenses = transactions
    .filter((t) => t.type === 'pengeluaran' && getMonthKey(t.date) === monthKey)
    .reduce((s, t) => s + t.total, 0);

  const monthIncome = transactions
    .filter((t) => t.type === 'pemasukan' && getMonthKey(t.date) === monthKey)
    .reduce((s, t) => s + t.total, 0);

  // BEP calculation: if we have products with HPP, calculate units needed
  const activeProducts = products.filter((p) => p.isActive && p.sellingPrice > 0 && p.hppCalculated > 0);
  const avgContribution = activeProducts.length > 0
    ? activeProducts.reduce((s, p) => s + (p.sellingPrice - p.hppCalculated), 0) / activeProducts.length
    : 0;
  const bepUnits = avgContribution > 0 ? Math.ceil(monthExpenses / avgContribution) : 0;
  const monthSalesUnits = transactions
    .filter((t) => t.type === 'pemasukan' && getMonthKey(t.date) === monthKey)
    .reduce((s, t) => s + t.quantity, 0);

  // ── Low stock items ──────────────────────────────────────────────────────────
  const lowStockItems = stocks.filter((s) => s.currentStock <= s.minimumStock);

  const handleTypeChange = (newType: 'pemasukan' | 'pengeluaran') => {
    setType(newType);
    setCategory('Lainnya');
    setHpp('0');
    setOperasionalCost('0');
    setSelectedProductId(null);
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProductId(product.id);
    setProductName(product.name);
    setPrice(product.sellingPrice.toString());
    setHpp(product.hppCalculated.toString());
    setCategory(product.category);
    setType('pemasukan');
  };

  const handleParseAndFillForm = useCallback((text: string) => {
    const parsed = parseVoiceText(text);
    setType(parsed.type);
    setProductName(parsed.name);
    setQuantity(parsed.quantity.toString());
    setPrice(parsed.price.toString());
    setHpp(parsed.hpp.toString());
    setCategory(parsed.category);
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' && recognition) {
      recognition.onstart = () => { setIsRecording(true); setSttError(null); };
      recognition.onresult = (event: any) => {
        const txt = event.results[0][0].transcript;
        setTranscript(txt);
        handleParseAndFillForm(txt);
      };
      recognition.onerror = (event: any) => {
        setSttError(`Mikrofon error: ${event.error}. Pastikan izin diberikan.`);
        setIsRecording(false);
      };
      recognition.onend = () => setIsRecording(false);
    }
  }, [handleParseAndFillForm]);

  const startSpeechToText = () => {
    if (Platform.OS === 'web') {
      if (recognition) {
        try {
          isRecording ? recognition.stop() : (setTranscript(''), recognition.start());
        } catch (e) { console.error(e); }
      } else {
        setSttError('Browser tidak mendukung STT. Gunakan Chrome/Safari.');
      }
    } else {
      setSttError('STT native memerlukan Development Build.');
    }
  };

  const handleSaveTransaction = () => {
    if (!productName.trim()) return;

    const qtyNum = parseInt(quantity) || 1;
    const priceNum = parseInt(price) || 0;
    const hppNum = type === 'pemasukan' ? (parseInt(hpp) || 0) : 0;
    const opsNum = type === 'pengeluaran' ? (parseInt(operasionalCost) || 0) : 0;

    addTransaction({
      type,
      name: productName,
      quantity: qtyNum,
      price: priceNum,
      hpp: hppNum,
      operasionalCost: opsNum,
      category,
      productId: selectedProductId || undefined,
    });

    // Update stock automatically
    if (type === 'pemasukan') {
      decreaseStock(productName, qtyNum);
    } else if (category === 'Bahan Baku') {
      increaseStock(productName, qtyNum);
    }

    // Reset form
    setProductName('');
    setQuantity('1');
    setPrice('0');
    setHpp('0');
    setOperasionalCost('0');
    setCategory('Lainnya');
    setTranscript('');
    setSttError(null);
    setSelectedProductId(null);
  };

  const totalCalc = (parseInt(quantity) || 1) * (parseInt(price) || 0);
  const categories = type === 'pemasukan' ? PEMASUKAN_CATEGORIES : PENGELUARAN_CATEGORIES;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingBottom: BottomTabInset + 80 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ── Header ── */}
            <View style={styles.header}>
              <View style={styles.headerRow}>
                <View>
                  <ThemedText type="title">Transaksi</ThemedText>
                  <ThemedText themeColor="textSecondary">
                    {userProfile?.business_name
                      ? `${userProfile.business_name} — Hari ini`
                      : 'Catat transaksi & pantau kondisi bisnis'}
                  </ThemedText>
                </View>
              </View>
            </View>

            {/* ── Today Summary ── */}
            <View style={styles.summaryRow}>
              <ThemedView type="backgroundElement" style={[styles.sumCard, { borderColor: colors.backgroundSelected }]}>
                <Feather name="trending-up" size={14} color="#22c55e" style={styles.sumIcon} />
                <Text style={styles.sumLabel}>Omset</Text>
                <Text style={[styles.sumValue, { color: colors.text }]}>Rp{todayOmset.toLocaleString('id-ID')}</Text>
              </ThemedView>
              <ThemedView type="backgroundElement" style={[styles.sumCard, { borderColor: colors.backgroundSelected }]}>
                <Feather name="shopping-bag" size={14} color="#ef4444" style={styles.sumIcon} />
                <Text style={styles.sumLabel}>Belanja</Text>
                <Text style={[styles.sumValue, { color: colors.text }]}>Rp{todayBelanja.toLocaleString('id-ID')}</Text>
              </ThemedView>
              <ThemedView type="backgroundElement" style={[styles.sumCard, { borderColor: colors.backgroundSelected }]}>
                <Feather name="dollar-sign" size={14} color={todayLaba >= 0 ? '#7c3aed' : '#ef4444'} style={styles.sumIcon} />
                <Text style={styles.sumLabel}>Laba Bersih</Text>
                <Text style={[styles.sumValue, { color: todayLaba >= 0 ? '#7c3aed' : '#ef4444' }]}>
                  {todayLaba >= 0 ? '+' : ''}Rp{todayLaba.toLocaleString('id-ID')}
                </Text>
              </ThemedView>
            </View>

            {/* ── BEP Quick Info ── */}
            {bepUnits > 0 && (
              <ThemedView type="backgroundElement" style={[styles.bepCard, { borderColor: colors.backgroundSelected }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Feather name="target" size={14} color="#f59e0b" />
                  <Text style={[styles.bepTitle, { color: colors.text }]}>BEP Bulan Ini</Text>
                </View>
                <Text style={[styles.bepText, { color: colors.textSecondary }]}>
                  Perlu menjual <Text style={{ color: '#f59e0b', fontWeight: '800' }}>{bepUnits} unit</Text> untuk menutup biaya Rp{monthExpenses.toLocaleString('id-ID')}.
                  {monthSalesUnits >= bepUnits
                    ? ` ✅ Sudah tercapai! (${monthSalesUnits} unit terjual)`
                    : ` Sudah ${monthSalesUnits}/${bepUnits} unit (sisa ${bepUnits - monthSalesUnits}).`
                  }
                </Text>
              </ThemedView>
            )}

            {/* ── Low Stock Alert ── */}
            {lowStockItems.length > 0 && (
              <ThemedView type="backgroundElement" style={[styles.alertCard, { borderColor: '#f59e0b' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.one }}>
                  <Feather name="alert-triangle" size={14} color="#f59e0b" />
                  <Text style={[styles.alertTitle, { color: colors.text }]}>
                    Stok Rendah ({lowStockItems.length} item)
                  </Text>
                </View>
                {lowStockItems.map((s) => (
                  <Text key={s.id} style={[styles.alertItem, { color: colors.textSecondary }]}>
                    • {s.name}: {s.currentStock} {s.unit} (min. {s.minimumStock})
                  </Text>
                ))}
              </ThemedView>
            )}

            {/* ── Quick Add from Catalog ── */}
            {products.filter(p => p.isActive).length > 0 && type === 'pemasukan' && (
              <ThemedView type="backgroundElement" style={[styles.quickCard, { borderColor: colors.backgroundSelected }]}>
                <View style={styles.cardHeader}>
                  <Feather name="zap" size={14} color={colors.primary} />
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Jual Cepat dari Katalog</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: Spacing.two, paddingRight: Spacing.two }}>
                  {products.filter(p => p.isActive).map((p) => (
                    <Pressable key={p.id} onPress={() => handleSelectProduct(p)}
                      style={[styles.quickItem, {
                        backgroundColor: selectedProductId === p.id ? colors.primary : colors.backgroundSelected,
                      }]}>
                      <Text style={[styles.quickName, {
                        color: selectedProductId === p.id ? '#fff' : colors.text
                      }]}>{p.name}</Text>
                      <Text style={[styles.quickPrice, {
                        color: selectedProductId === p.id ? 'rgba(255,255,255,.7)' : colors.textSecondary
                      }]}>Rp{p.sellingPrice.toLocaleString('id-ID')}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </ThemedView>
            )}

            {/* ── Pencatatan Form Card ── */}
            <ThemedView type="backgroundElement" style={[styles.formCard, { borderColor: colors.backgroundSelected }]}>
              {/* Type switcher */}
              <View style={styles.typeSwitcher}>
                <Pressable
                  onPress={() => handleTypeChange('pemasukan')}
                  style={[styles.typeBtn,
                    type === 'pemasukan' && { backgroundColor: '#22c55e' },
                    type !== 'pemasukan' && { backgroundColor: colors.backgroundSelected },
                  ]}>
                  <Feather name="arrow-up-circle" size={14} color={type === 'pemasukan' ? '#fff' : colors.textSecondary} />
                  <Text style={[styles.typeBtnText, { color: type === 'pemasukan' ? '#fff' : colors.textSecondary }]}>
                    Penjualan
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => handleTypeChange('pengeluaran')}
                  style={[styles.typeBtn,
                    type === 'pengeluaran' && { backgroundColor: '#ef4444' },
                    type !== 'pengeluaran' && { backgroundColor: colors.backgroundSelected },
                  ]}>
                  <Feather name="arrow-down-circle" size={14} color={type === 'pengeluaran' ? '#fff' : colors.textSecondary} />
                  <Text style={[styles.typeBtnText, { color: type === 'pengeluaran' ? '#fff' : colors.textSecondary }]}>
                    Belanja/Biaya
                  </Text>
                </Pressable>
              </View>

              {/* STT Button */}
              <Pressable
                onPress={startSpeechToText}
                style={({ pressed }) => [
                  styles.sttBtn,
                  { backgroundColor: isRecording ? '#ef4444' : colors.primary },
                  pressed && { opacity: 0.8 },
                ]}>
                <Feather name={isRecording ? 'mic-off' : 'mic'} size={18} color="#fff" />
                <Text style={styles.sttBtnText}>
                  {isRecording ? 'Mendengarkan...' : 'Rekam Suara (STT)'}
                </Text>
                {isRecording && <ActivityIndicator size="small" color="#fff" style={{ marginLeft: 4 }} />}
              </Pressable>

              {transcript !== '' && (
                <ThemedView type="backgroundElement" style={[styles.transcriptBox, { borderColor: colors.backgroundSelected }]}>
                  <Text style={[styles.transcriptLabel, { color: colors.textSecondary }]}>Hasil STT:</Text>
                  <Text style={[styles.transcriptText, { color: colors.text }]}>"{transcript}"</Text>
                </ThemedView>
              )}

              {sttError && (
                <View style={styles.errorBanner}>
                  <Feather name="alert-circle" size={12} color="#ea580c" />
                  <Text style={styles.errorText}>{sttError}</Text>
                </View>
              )}

              {/* ── Manual Fields ── */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                {type === 'pemasukan' ? 'Nama Produk / Layanan' : 'Nama Belanja / Biaya'}
              </Text>
              <TextInput
                value={productName}
                onChangeText={setProductName}
                placeholder={type === 'pemasukan' ? 'cth: Nasi Goreng' : 'cth: Beli Beras'}
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, { color: colors.text, borderColor: colors.backgroundSelected }]}
              />

              <View style={styles.rowFields}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Jumlah</Text>
                  <TextInput
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="number-pad"
                    style={[styles.input, { color: colors.text, borderColor: colors.backgroundSelected }]}
                  />
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                    {type === 'pemasukan' ? 'Harga Jual (Rp)' : 'Harga Satuan (Rp)'}
                  </Text>
                  <TextInput
                    value={price}
                    onChangeText={setPrice}
                    keyboardType="number-pad"
                    style={[styles.input, { color: colors.text, borderColor: colors.backgroundSelected }]}
                  />
                </View>
              </View>

              {type === 'pemasukan' && (
                <>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>HPP / Modal per Unit (Rp)</Text>
                  <TextInput
                    value={hpp}
                    onChangeText={setHpp}
                    keyboardType="number-pad"
                    style={[styles.input, { color: colors.text, borderColor: colors.backgroundSelected }]}
                  />
                  {selectedProductId && (
                    <Text style={[styles.hppHint, { color: '#22c55e' }]}>
                      ✓ HPP otomatis dari katalog produk
                    </Text>
                  )}
                </>
              )}

              {type === 'pengeluaran' && (
                <>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Biaya Operasional Tambahan (Rp)</Text>
                  <TextInput
                    value={operasionalCost}
                    onChangeText={setOperasionalCost}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={colors.textSecondary}
                    style={[styles.input, { color: colors.text, borderColor: colors.backgroundSelected }]}
                  />
                </>
              )}

              {/* Category */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Kategori</Text>
              <View style={styles.catRow}>
                {categories.map((cat) => (
                  <Pressable
                    key={cat}
                    onPress={() => setCategory(cat)}
                    style={[styles.catBtn,
                      category === cat && { backgroundColor: colors.primary },
                      category !== cat && { backgroundColor: colors.backgroundSelected },
                    ]}>
                    <Text style={[styles.catBtnText, { color: category === cat ? '#fff' : colors.textSecondary }]}>
                      {cat}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Total Preview */}
              <ThemedView type="backgroundSelected" style={styles.totalPreview}>
                <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Total Transaksi</Text>
                <Text style={[styles.totalValue, { color: type === 'pemasukan' ? '#22c55e' : '#ef4444' }]}>
                  {type === 'pemasukan' ? '+' : '−'}Rp{totalCalc.toLocaleString('id-ID')}
                </Text>
                {type === 'pemasukan' && parseInt(hpp) > 0 && (
                  <Text style={[styles.totalSub, { color: '#22c55e' }]}>
                    Estimasi Laba: +Rp{(totalCalc - (parseInt(hpp) || 0) * (parseInt(quantity) || 1)).toLocaleString('id-ID')}
                  </Text>
                )}
              </ThemedView>

              {/* Save Button */}
              <Pressable
                onPress={handleSaveTransaction}
                disabled={!productName.trim()}
                style={({ pressed }) => [
                  styles.saveBtn,
                  { backgroundColor: productName.trim() ? colors.primary : colors.backgroundSelected },
                  pressed && { opacity: 0.8 },
                ]}>
                <Feather name="save" size={16} color={productName.trim() ? '#fff' : colors.textSecondary} />
                <Text style={[styles.saveBtnText, { color: productName.trim() ? '#fff' : colors.textSecondary }]}>
                  Simpan Transaksi
                </Text>
              </Pressable>
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

  // Summary Cards
  summaryRow: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.three },
  sumCard: { flex: 1, padding: Spacing.two, borderRadius: BorderRadius.medium, borderWidth: 1.5 },
  sumIcon: { marginBottom: 4 },
  sumLabel: { fontSize: 9, fontWeight: '700', color: '#9ca3af', marginBottom: 2 },
  sumValue: { fontSize: 12, fontWeight: '800' },

  // BEP
  bepCard: { padding: Spacing.three, borderRadius: BorderRadius.medium, borderWidth: 1.5, marginBottom: Spacing.three },
  bepTitle: { fontWeight: '800', fontSize: 12 },
  bepText: { fontSize: 12, fontWeight: '600', lineHeight: 18, marginTop: Spacing.one },

  // Alerts
  alertCard: { padding: Spacing.three, borderRadius: BorderRadius.medium, borderWidth: 1.5, marginBottom: Spacing.three },
  alertTitle: { fontWeight: '800', fontSize: 12 },
  alertItem: { fontSize: 11, fontWeight: '600', marginTop: 2 },

  // Quick add
  quickCard: { padding: Spacing.three, borderRadius: BorderRadius.medium, borderWidth: 1.5, marginBottom: Spacing.three },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.two },
  cardTitle: { fontWeight: '800', fontSize: 13, flex: 1 },
  quickItem: {
    paddingHorizontal: Spacing.three, paddingVertical: Spacing.two,
    borderRadius: BorderRadius.medium, minWidth: 100, alignItems: 'center',
  },
  quickName: { fontWeight: '800', fontSize: 12, marginBottom: 2 },
  quickPrice: { fontSize: 10, fontWeight: '600' },

  // Form
  formCard: { padding: Spacing.three, borderRadius: BorderRadius.medium, borderWidth: 1.5, marginBottom: Spacing.three },
  typeSwitcher: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.three },
  typeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: Spacing.two, borderRadius: BorderRadius.small,
  },
  typeBtnText: { fontWeight: '800', fontSize: 13 },

  // STT
  sttBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.two, padding: Spacing.three, borderRadius: BorderRadius.medium, marginBottom: Spacing.two,
  },
  sttBtnText: { color: '#fff', fontWeight: '800', fontSize: 14, flex: 1 },
  transcriptBox: { padding: Spacing.two, borderRadius: BorderRadius.small, borderWidth: 1, marginBottom: Spacing.two },
  transcriptLabel: { fontSize: 10, fontWeight: '700', marginBottom: 2 },
  transcriptText: { fontSize: 12, fontWeight: '600', fontStyle: 'italic' },
  errorBanner: {
    flexDirection: 'row', gap: 4, alignItems: 'center',
    backgroundColor: 'rgba(234,88,12,.1)', padding: Spacing.two,
    borderRadius: BorderRadius.small, marginBottom: Spacing.two,
  },
  errorText: { color: '#ea580c', fontSize: 11, fontWeight: '600', flex: 1 },

  fieldLabel: { fontSize: 11, fontWeight: '700', marginBottom: Spacing.one, marginTop: Spacing.two },
  hppHint: { fontSize: 11, fontWeight: '700', marginTop: 4 },
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

  totalPreview: {
    padding: Spacing.three, borderRadius: BorderRadius.small, marginBottom: Spacing.three, alignItems: 'center',
  },
  totalLabel: { fontSize: 11, fontWeight: '700', marginBottom: 2 },
  totalValue: { fontSize: 22, fontWeight: '800' },
  totalSub: { fontSize: 11, fontWeight: '700', marginTop: 2 },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, padding: Spacing.three, borderRadius: BorderRadius.medium,
  },
  saveBtnText: { fontWeight: '800', fontSize: 15 },
});
