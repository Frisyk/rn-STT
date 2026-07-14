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
import { useStockStore, StockItem } from '@/store/stockStore';

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

// ── STT Simulation data ──────────────────────────────────────────────────────
const MOCK_PEMASUKAN = [
  { text: 'Jual nasi goreng dua porsi harga lima belas ribu modal sepuluh ribu', label: 'Nasi Goreng (2×Rp15rb, Modal Rp10rb)' },
  { text: 'Kopi susu tiga gelas seharga sepuluh ribu modal enam ribu', label: 'Kopi Susu (3×Rp10rb, Modal Rp6rb)' },
  { text: 'Potong rambut pria satu jasa harga lima puluh ribu modal nol', label: 'Potong Rambut (1×Rp50rb)' },
];

const MOCK_PENGELUARAN = [
  { text: 'Beli beras pandan wangi satu karung harga seratus dua puluh ribu', label: 'Beras (1×Rp120rb)' },
  { text: 'Bayar listrik toko bulanan seharga seratus lima puluh ribu', label: 'Listrik Toko (Rp150rb)' },
  { text: 'Gaji karyawan harian satu orang seratus ribu rupiah', label: 'Gaji Harian (Rp100rb)' },
];

// ── NLP Parser ───────────────────────────────────────────────────────────────
const parseVoiceText = (text: string) => {
  const lowercase = text.toLowerCase();

  const expenseKeywords = ['beli', 'belanja', 'bayar', 'sewa', 'gaji', 'utilitas', 'operasional', 'pengeluaran', 'keluar'];
  const isExpense = expenseKeywords.some((kw) => lowercase.includes(kw));
  const type: 'pemasukan' | 'pengeluaran' = isExpense ? 'pengeluaran' : 'pemasukan';

  const numberWords: { [key: string]: number } = {
    satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10,
  };

  // Qty
  let qty = 1;
  const qtyRegex = /(?:(\d+)|(satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh))\s*(porsi|gelas|pax|buah|biji|pcs|ikat|piring|mangkuk|kg|bungkus|liter|karung|jasa|orang)/i;
  const qtyMatch = lowercase.match(qtyRegex);
  if (qtyMatch) {
    if (qtyMatch[1]) qty = parseInt(qtyMatch[1]);
    else if (qtyMatch[2]) qty = numberWords[qtyMatch[2]];
  }

  // Price
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

  // HPP
  let hpp = 0;
  if (type === 'pemasukan') {
    const modalMatch = cleanedText.match(/(?:modal|pokok|beli)\s*(?:sebesar)?\s*(\d+)\s*(ribu|juta)?/i);
    if (modalMatch) {
      const base = parseInt(modalMatch[1]);
      const unit = modalMatch[2]?.toLowerCase() ?? '';
      hpp = unit === 'ribu' ? base * 1000 : unit === 'juta' ? base * 1_000_000 : base;
    }
  }

  // Name cleanup
  let name = lowercase;
  name = name.replace(/(?:harga|seharga|total|bayar|nominal|rupiah)/gi, '');
  name = name.replace(/(?:porsi|gelas|pax|buah|biji|pcs|ikat|piring|mangkuk|kg|bungkus|liter|karung|jasa|orang)/gi, '');
  name = name.replace(/(?:modal|pokok|beli)\s*(?:sebesar)?\s*\d+\s*(?:ribu|juta)?/gi, '');
  Object.keys(numberWords).forEach((w) => { name = name.replace(new RegExp('\\b' + w + '\\b', 'gi'), ''); });
  name = name.replace(/\d+/g, '').replace(/\b(?:beli|pesan|catat|tambah|ada|transaksi|jual|laku|belanja|gaji|sewa|bayar)\b/gi, '');
  name = name.replace(/\s+/g, ' ').trim();
  name = name ? name.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : (type === 'pemasukan' ? 'Penjualan Baru' : 'Belanja Baru');

  // Category
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
  const { stocks, addStock, decreaseStock, increaseStock, updateStockItem, deleteStock } = useStockStore();

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

  // Price calculator
  const [calcHpp, setCalcHpp] = useState('');
  const [calcMargin, setCalcMargin] = useState('30');
  const suggestedPrice =
    parseFloat(calcHpp.replace(/\D/g, '')) > 0 && parseFloat(calcMargin) > 0 && parseFloat(calcMargin) < 100
      ? Math.ceil(parseFloat(calcHpp.replace(/\D/g, '')) / (1 - parseFloat(calcMargin) / 100))
      : null;

  // Stock form
  const [showStockForm, setShowStockForm] = useState(false);
  const [stockName, setStockName] = useState('');
  const [stockUnit, setStockUnit] = useState('pcs');
  const [stockInitial, setStockInitial] = useState('');
  const [stockMin, setStockMin] = useState('5');
  const [stockCostPrice, setStockCostPrice] = useState('');
  const [stockSellingPrice, setStockSellingPrice] = useState('');

  // ── Today's summary ──────────────────────────────────────────────────────────
  const todayKey = new Date().toISOString().substring(0, 10);
  const todayTx = transactions.filter((t) => t.date.substring(0, 10) === todayKey);
  const todayOmset = todayTx.filter((t) => t.type === 'pemasukan').reduce((s, t) => s + t.total, 0);
  const todayBelanja = todayTx.filter((t) => t.type === 'pengeluaran').reduce((s, t) => s + t.total, 0);
  const todayLaba = todayTx.reduce((s, t) => s + t.profit, 0);

  // ── BEP today (fixed cost = total expenses today, contribution = avg selling - hpp) ──
  const monthKey = getMonthKey(new Date().toISOString());
  const monthExpenses = transactions
    .filter((t) => t.type === 'pengeluaran' && getMonthKey(t.date) === monthKey)
    .reduce((s, t) => s + t.total, 0);

  // ── Low stock items ──────────────────────────────────────────────────────────
  const lowStockItems = stocks.filter((s) => s.currentStock <= s.minimumStock);

  const handleTypeChange = (newType: 'pemasukan' | 'pengeluaran') => {
    setType(newType);
    setCategory('Lainnya');
    setHpp('0');
    setOperasionalCost('0');
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
      setSttError('STT native memerlukan Development Build. Gunakan simulasi di bawah.');
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

    router.push('/past' as any);
  };

  const handleAddStock = () => {
    if (!stockName.trim()) return;
    addStock({
      name: stockName,
      category: 'Produk',
      unit: stockUnit,
      currentStock: parseInt(stockInitial) || 0,
      minimumStock: parseInt(stockMin) || 5,
      costPrice: parseInt(stockCostPrice.replace(/\D/g, '')) || 0,
      sellingPrice: parseInt(stockSellingPrice.replace(/\D/g, '')) || 0,
    });
    setStockName(''); setStockUnit('pcs'); setStockInitial('');
    setStockMin('5'); setStockCostPrice(''); setStockSellingPrice('');
    setShowStockForm(false);
  };

  const totalCalc = (parseInt(quantity) || 1) * (parseInt(price) || 0);
  const categories = type === 'pemasukan' ? PEMASUKAN_CATEGORIES : PENGELUARAN_CATEGORIES;
  const simList = type === 'pemasukan' ? MOCK_PEMASUKAN : MOCK_PENGELUARAN;

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
              <ThemedText type="title">Operasional Hari Ini</ThemedText>
              <ThemedText themeColor="textSecondary">Catat transaksi & pantau kondisi bisnis real-time</ThemedText>
            </View>

            {/* ── Today Summary ── */}
            <View style={styles.summaryRow}>
              <ThemedView type="backgroundElement" style={[styles.sumCard, { borderColor: colors.backgroundSelected }]}>
                <Feather name="trending-up" size={14} color="#22c55e" style={styles.sumIcon} />
                <Text style={styles.sumLabel}>Omset Hari Ini</Text>
                <Text style={[styles.sumValue, { color: colors.text }]}>Rp{todayOmset.toLocaleString('id-ID')}</Text>
              </ThemedView>
              <ThemedView type="backgroundElement" style={[styles.sumCard, { borderColor: colors.backgroundSelected }]}>
                <Feather name="shopping-bag" size={14} color="#ef4444" style={styles.sumIcon} />
                <Text style={styles.sumLabel}>Belanja Hari Ini</Text>
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

            {/* ── Low Stock Alert ── */}
            {lowStockItems.length > 0 && (
              <ThemedView type="backgroundElement" style={[styles.alertCard, { borderColor: '#f59e0b' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.one }}>
                  <Feather name="alert-triangle" size={14} color="#f59e0b" />
                  <Text style={[styles.alertTitle, { color: colors.text }]}>
                    Peringatan Stok Rendah ({lowStockItems.length} item)
                  </Text>
                </View>
                {lowStockItems.map((s) => (
                  <Text key={s.id} style={[styles.alertItem, { color: colors.textSecondary }]}>
                    • {s.name}: {s.currentStock} {s.unit} (min. {s.minimumStock})
                  </Text>
                ))}
              </ThemedView>
            )}

            {/* ── Pencatatan Form Card ── */}
            <ThemedView type="backgroundElement" style={[styles.formCard, { borderColor: colors.backgroundSelected }]}>
              {/* Type switcher */}
              <View style={styles.typeSwitcher}>
                <Pressable
                  onPress={() => handleTypeChange('pemasukan')}
                  style={[
                    styles.typeBtn,
                    type === 'pemasukan' && { backgroundColor: '#22c55e' },
                    type !== 'pemasukan' && { backgroundColor: colors.backgroundSelected },
                  ]}
                >
                  <Feather name="arrow-up-circle" size={14} color={type === 'pemasukan' ? '#fff' : colors.textSecondary} />
                  <Text style={[styles.typeBtnText, { color: type === 'pemasukan' ? '#fff' : colors.textSecondary }]}>
                    Penjualan
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => handleTypeChange('pengeluaran')}
                  style={[
                    styles.typeBtn,
                    type === 'pengeluaran' && { backgroundColor: '#ef4444' },
                    type !== 'pengeluaran' && { backgroundColor: colors.backgroundSelected },
                  ]}
                >
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
                ]}
              >
                <Feather name={isRecording ? 'mic-off' : 'mic'} size={18} color="#fff" />
                <Text style={styles.sttBtnText}>
                  {isRecording ? 'Mendengarkan... (ketuk untuk berhenti)' : 'Rekam Suara (STT)'}
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

              {/* Simulation buttons */}
              <View style={styles.simRow}>
                <Text style={[styles.simLabel, { color: colors.textSecondary }]}>Simulasi STT:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.one }}>
                  {simList.map((s, i) => (
                    <Pressable
                      key={i}
                      onPress={() => { setTranscript(s.text); handleParseAndFillForm(s.text); }}
                      style={[styles.simBtn, { backgroundColor: colors.backgroundSelected }]}
                    >
                      <Text style={[styles.simBtnText, { color: colors.textSecondary }]}>{s.label}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

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
                    style={[
                      styles.catBtn,
                      category === cat && { backgroundColor: colors.primary },
                      category !== cat && { backgroundColor: colors.backgroundSelected },
                    ]}
                  >
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
                ]}
              >
                <Feather name="save" size={16} color={productName.trim() ? '#fff' : colors.textSecondary} />
                <Text style={[styles.saveBtnText, { color: productName.trim() ? '#fff' : colors.textSecondary }]}>
                  Simpan Transaksi
                </Text>
              </Pressable>
            </ThemedView>

            {/* ── Kalkulator Harga Jual ── */}
            <ThemedView type="backgroundElement" style={[styles.calcCard, { borderColor: colors.backgroundSelected }]}>
              <View style={styles.cardHeader}>
                <Feather name="sliders" size={14} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>Kalkulator Harga Jual</Text>
              </View>
              <Text style={[styles.formula, { color: colors.textSecondary }]}>
                Harga Jual = HPP ÷ (1 − Target Margin%)
              </Text>
              <View style={[styles.rowFields, { marginTop: Spacing.two }]}>
                <View style={{ flex: 1.5 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>HPP per Unit (Rp)</Text>
                  <TextInput
                    value={calcHpp}
                    onChangeText={setCalcHpp}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={colors.textSecondary}
                    style={[styles.input, { color: colors.text, borderColor: colors.backgroundSelected }]}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Margin (%)</Text>
                  <TextInput
                    value={calcMargin}
                    onChangeText={setCalcMargin}
                    keyboardType="decimal-pad"
                    style={[styles.input, { color: colors.text, borderColor: colors.backgroundSelected }]}
                  />
                </View>
              </View>
              {suggestedPrice !== null && (
                <ThemedView type="backgroundSelected" style={styles.suggestedPrice}>
                  <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Harga Jual Minimum</Text>
                  <Text style={[styles.totalValue, { color: colors.primary }]}>
                    Rp{suggestedPrice.toLocaleString('id-ID')}
                  </Text>
                </ThemedView>
              )}
            </ThemedView>

            {/* ── Stock Management ── */}
            <ThemedView type="backgroundElement" style={[styles.calcCard, { borderColor: colors.backgroundSelected }]}>
              <View style={styles.cardHeader}>
                <Feather name="box" size={14} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>Manajemen Stok</Text>
                <Pressable
                  onPress={() => setShowStockForm(!showStockForm)}
                  style={[styles.addBtn, { backgroundColor: colors.primary }]}
                >
                  <Feather name={showStockForm ? 'x' : 'plus'} size={12} color="#fff" />
                  <Text style={styles.addBtnText}>{showStockForm ? 'Batal' : 'Tambah'}</Text>
                </Pressable>
              </View>

              {showStockForm && (
                <View style={[styles.stockForm, { borderColor: colors.backgroundSelected }]}>
                  <TextInput
                    value={stockName}
                    onChangeText={setStockName}
                    placeholder="Nama Produk/Bahan"
                    placeholderTextColor={colors.textSecondary}
                    style={[styles.input, { color: colors.text, borderColor: colors.backgroundSelected }]}
                  />
                  <View style={styles.rowFields}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Stok Awal</Text>
                      <TextInput
                        value={stockInitial}
                        onChangeText={setStockInitial}
                        keyboardType="number-pad"
                        style={[styles.input, { color: colors.text, borderColor: colors.backgroundSelected }]}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Stok Min.</Text>
                      <TextInput
                        value={stockMin}
                        onChangeText={setStockMin}
                        keyboardType="number-pad"
                        style={[styles.input, { color: colors.text, borderColor: colors.backgroundSelected }]}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Satuan</Text>
                      <TextInput
                        value={stockUnit}
                        onChangeText={setStockUnit}
                        placeholder="pcs"
                        placeholderTextColor={colors.textSecondary}
                        style={[styles.input, { color: colors.text, borderColor: colors.backgroundSelected }]}
                      />
                    </View>
                  </View>
                  <View style={styles.rowFields}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>HPP/Unit (Rp)</Text>
                      <TextInput
                        value={stockCostPrice}
                        onChangeText={setStockCostPrice}
                        keyboardType="number-pad"
                        placeholder="0"
                        placeholderTextColor={colors.textSecondary}
                        style={[styles.input, { color: colors.text, borderColor: colors.backgroundSelected }]}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Harga Jual (Rp)</Text>
                      <TextInput
                        value={stockSellingPrice}
                        onChangeText={setStockSellingPrice}
                        keyboardType="number-pad"
                        placeholder="0"
                        placeholderTextColor={colors.textSecondary}
                        style={[styles.input, { color: colors.text, borderColor: colors.backgroundSelected }]}
                      />
                    </View>
                  </View>
                  <Pressable
                    onPress={handleAddStock}
                    style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                  >
                    <Text style={[styles.saveBtnText, { color: '#fff' }]}>Simpan Produk</Text>
                  </Pressable>
                </View>
              )}

              {stocks.length === 0 ? (
                <Text style={[styles.emptyStock, { color: colors.textSecondary }]}>
                  Belum ada produk. Tambahkan produk untuk memantau stok secara otomatis.
                </Text>
              ) : (
                stocks.map((s) => (
                  <View key={s.id} style={[styles.stockRow, { borderColor: colors.backgroundSelected }]}>
                    <View style={styles.stockLeft}>
                      <Text style={[styles.stockName, { color: colors.text }]}>{s.name}</Text>
                      <Text style={styles.stockSub}>{s.category} · @Rp{s.costPrice.toLocaleString('id-ID')}</Text>
                    </View>
                    <View style={styles.stockRight}>
                      <View style={[
                        styles.stockBadge,
                        { backgroundColor: s.currentStock <= s.minimumStock ? 'rgba(239,68,68,.12)' : 'rgba(34,197,94,.12)' }
                      ]}>
                        <Text style={[
                          styles.stockBadgeText,
                          { color: s.currentStock <= s.minimumStock ? '#ef4444' : '#22c55e' }
                        ]}>
                          {s.currentStock} {s.unit}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.stockActions}>
                      <Pressable
                        onPress={() => updateStockItem(s.id, { currentStock: Math.max(0, s.currentStock - 1) })}
                        style={[styles.stockAdjBtn, { backgroundColor: colors.backgroundSelected }]}
                      >
                        <Feather name="minus" size={12} color={colors.text} />
                      </Pressable>
                      <Pressable
                        onPress={() => updateStockItem(s.id, { currentStock: s.currentStock + 1 })}
                        style={[styles.stockAdjBtn, { backgroundColor: colors.backgroundSelected }]}
                      >
                        <Feather name="plus" size={12} color={colors.text} />
                      </Pressable>
                      <Pressable
                        onPress={() => deleteStock(s.id)}
                        style={({ pressed }) => [pressed && { opacity: 0.5 }]}
                      >
                        <Feather name="trash-2" size={14} color="#ef4444" />
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </ThemedView>

            {/* ── BEP quick card ── */}
            <ThemedView type="backgroundElement" style={[styles.calcCard, { borderColor: colors.backgroundSelected }]}>
              <View style={styles.cardHeader}>
                <Feather name="activity" size={14} color="#f59e0b" />
                <Text style={[styles.cardTitle, { color: colors.text }]}>Status BEP Bulan Ini</Text>
              </View>
              <Text style={[styles.formula, { color: colors.textSecondary }]}>
                BEP = Biaya Tetap ÷ (Harga Jual − Biaya Variabel) per Unit
              </Text>
              <View style={[styles.pphRow, { marginTop: Spacing.two }]}>
                <View>
                  <Text style={styles.pphLabel}>Total Biaya Bulan Ini</Text>
                  <Text style={[styles.pphValue, { color: colors.text }]}>
                    Rp{monthExpenses.toLocaleString('id-ID')}
                  </Text>
                </View>
                <View>
                  <Text style={styles.pphLabel}>Omset Bulan Ini</Text>
                  <Text style={[styles.pphValue, { color: '#22c55e' }]}>
                    Rp{transactions
                      .filter((t) => t.type === 'pemasukan' && getMonthKey(t.date) === monthKey)
                      .reduce((s, t) => s + t.total, 0)
                      .toLocaleString('id-ID')}
                  </Text>
                </View>
              </View>
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

  // Summary Cards
  summaryRow: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.three },
  sumCard: { flex: 1, padding: Spacing.two, borderRadius: BorderRadius.medium, borderWidth: 1.5 },
  sumIcon: { marginBottom: 4 },
  sumLabel: { fontSize: 9, fontWeight: '700', color: '#9ca3af', marginBottom: 2 },
  sumValue: { fontSize: 12, fontWeight: '800' },

  // Alerts
  alertCard: { padding: Spacing.three, borderRadius: BorderRadius.medium, borderWidth: 1.5, marginBottom: Spacing.three },
  alertTitle: { fontWeight: '800', fontSize: 12 },
  alertItem: { fontSize: 11, fontWeight: '600', marginTop: 2 },

  // Form
  formCard: { padding: Spacing.three, borderRadius: BorderRadius.medium, borderWidth: 1.5, marginBottom: Spacing.three },
  typeSwitcher: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.three },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.small,
  },
  typeBtnText: { fontWeight: '800', fontSize: 13 },

  // STT
  sttBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: BorderRadius.medium,
    marginBottom: Spacing.two,
  },
  sttBtnText: { color: '#fff', fontWeight: '800', fontSize: 14, flex: 1 },

  transcriptBox: {
    padding: Spacing.two,
    borderRadius: BorderRadius.small,
    borderWidth: 1,
    marginBottom: Spacing.two,
  },
  transcriptLabel: { fontSize: 10, fontWeight: '700', marginBottom: 2 },
  transcriptText: { fontSize: 12, fontWeight: '600', fontStyle: 'italic' },

  errorBanner: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    backgroundColor: 'rgba(234,88,12,.1)',
    padding: Spacing.two,
    borderRadius: BorderRadius.small,
    marginBottom: Spacing.two,
  },
  errorText: { color: '#ea580c', fontSize: 11, fontWeight: '600', flex: 1 },

  simRow: { marginBottom: Spacing.three },
  simLabel: { fontSize: 10, fontWeight: '700', marginBottom: Spacing.one },
  simBtn: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: BorderRadius.small,
  },
  simBtnText: { fontSize: 10, fontWeight: '700' },

  fieldLabel: { fontSize: 11, fontWeight: '700', marginBottom: Spacing.one, marginTop: Spacing.two },
  input: {
    borderWidth: 1.5,
    borderRadius: BorderRadius.small,
    paddingHorizontal: Spacing.two,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 14,
    fontWeight: '600',
  },
  rowFields: { flexDirection: 'row', gap: Spacing.two },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one, marginBottom: Spacing.two },
  catBtn: { paddingHorizontal: Spacing.two, paddingVertical: 4, borderRadius: BorderRadius.full },
  catBtnText: { fontSize: 11, fontWeight: '700' },

  totalPreview: {
    padding: Spacing.three,
    borderRadius: BorderRadius.small,
    marginBottom: Spacing.three,
    alignItems: 'center',
  },
  totalLabel: { fontSize: 11, fontWeight: '700', marginBottom: 2 },
  totalValue: { fontSize: 22, fontWeight: '800' },
  totalSub: { fontSize: 11, fontWeight: '700', marginTop: 2 },

  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: Spacing.three,
    borderRadius: BorderRadius.medium,
  },
  saveBtnText: { fontWeight: '800', fontSize: 15 },

  // Calculator & other cards
  calcCard: { padding: Spacing.three, borderRadius: BorderRadius.medium, borderWidth: 1.5, marginBottom: Spacing.three },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.two },
  cardTitle: { fontWeight: '800', fontSize: 13, flex: 1 },
  formula: { fontSize: 10, fontWeight: '600', lineHeight: 14 },
  suggestedPrice: { padding: Spacing.two, borderRadius: BorderRadius.small, alignItems: 'center', marginTop: Spacing.two },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: BorderRadius.small,
  },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 11 },

  // Stock
  stockForm: { borderWidth: 1, borderRadius: BorderRadius.small, padding: Spacing.two, marginBottom: Spacing.two },
  emptyStock: { fontSize: 12, fontWeight: '600', textAlign: 'center', paddingVertical: Spacing.three },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderTopWidth: 1,
    gap: Spacing.two,
  },
  stockLeft: { flex: 1 },
  stockName: { fontWeight: '800', fontSize: 13 },
  stockSub: { fontSize: 10, color: '#9ca3af', fontWeight: '600', marginTop: 2 },
  stockRight: {},
  stockBadge: { paddingHorizontal: Spacing.two, paddingVertical: 3, borderRadius: BorderRadius.small },
  stockBadgeText: { fontWeight: '800', fontSize: 12 },
  stockActions: { flexDirection: 'row', gap: Spacing.one, alignItems: 'center' },
  stockAdjBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },

  pphRow: { flexDirection: 'row', justifyContent: 'space-between' },
  pphLabel: { fontSize: 11, fontWeight: '700', color: '#9ca3af', marginBottom: 2 },
  pphValue: { fontSize: 16, fontWeight: '800' },
});
