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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing, Colors, BorderRadius } from '@/constants/theme';
import { useTransactionStore } from '@/store/transactionStore';
import { Feather } from '@expo/vector-icons';

// Web Speech Recognition Setup
let recognition: any = null;
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'id-ID'; // Bahasa Indonesia
    recognition.interimResults = false;
  }
}

const PEMASUKAN_CATEGORIES = ['Makanan', 'Minuman', 'Barang', 'Jasa', 'Lainnya'] as const;
const PENGELUARAN_CATEGORIES = ['Bahan Baku', 'Operasional', 'Sewa', 'Gaji', 'Lainnya'] as const;

// Mock speech examples for testing in Expo Go
const MOCK_PEMASUKAN = [
  { text: 'Jual nasi goreng dua porsi harga lima belas ribu modal sepuluh ribu', label: 'Nasi Goreng (2 x Rp15.000, Modal Rp10.000)' },
  { text: 'Kopi susu tiga gelas seharga sepuluh ribu modal enam ribu', label: 'Kopi Susu (3 x Rp10.000, Modal Rp6.000)' },
  { text: 'Potong rambut pria satu jasa harga lima puluh ribu modal nol', label: 'Potong Rambut (1 x Rp50.000, Modal Rp0)' },
];

const MOCK_PENGELUARAN = [
  { text: 'Beli beras pandan wangi satu karung harga seratus dua puluh ribu', label: 'Beras (1 x Rp120.000)' },
  { text: 'Bayar listrik toko bulanan seharga seratus lima puluh ribu', label: 'Listrik Toko (1 x Rp150.000)' },
  { text: 'Gaji karyawan harian satu orang seratus ribu rupiah', label: 'Gaji Harian (1 x Rp100.000)' },
];

// Parser helper function
const parseVoiceText = (text: string) => {
  const lowercase = text.toLowerCase();
  
  // 1. Determine type
  const expenseKeywords = ['beli', 'belanja', 'bayar', 'sewa', 'gaji', 'utilitas', 'operasional', 'pengeluaran', 'keluar'];
  const isExpense = expenseKeywords.some((kw) => lowercase.includes(kw));
  const type: 'pemasukan' | 'pengeluaran' = isExpense ? 'pengeluaran' : 'pemasukan';

  const numberWords: { [key: string]: number } = {
    satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10
  };

  // 2. Parse quantity
  let qty = 1;
  const qtyRegex = /(?:(\d+)|(satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh))\s*(porsi|gelas|pax|buah|biji|pcs|ikat|piring|mangkuk|kg|bungkus|liter|karung|jasa|orang)/i;
  const qtyMatch = lowercase.match(qtyRegex);
  if (qtyMatch) {
    if (qtyMatch[1]) {
      qty = parseInt(qtyMatch[1]);
    } else if (qtyMatch[2]) {
      qty = numberWords[qtyMatch[2]];
    }
  } else {
    const simpleNumRegex = /\b(\d+)\b/g;
    let match;
    while ((match = simpleNumRegex.exec(lowercase)) !== null) {
      const val = parseInt(match[1]);
      if (val < 20) {
        qty = val;
        break;
      }
    }
  }

  // 3. Helper to parse price/money words
  let cleanedText = lowercase;
  const wordToNumMap: [RegExp, string][] = [
    [/sebelas/g, '11'],
    [/dua\s*belas/g, '12'],
    [/tiga\s*belas/g, '13'],
    [/empat\s*belas/g, '14'],
    [/lima\s*belas/g, '15'],
    [/enam\s*belas/g, '16'],
    [/tujuh\s*belas/g, '17'],
    [/delapan\s*belas/g, '18'],
    [/sembilan\s*belas/g, '19'],
    [/sepuluh/g, '10'],
    [/dua\s*puluh/g, '20'],
    [/tiga\s*puluh/g, '30'],
    [/empat\s*puluh/g, '40'],
    [/lima\s*puluh/g, '50'],
    [/enam\s*puluh/g, '60'],
    [/tujuh\s*puluh/g, '70'],
    [/delapan\s*puluh/g, '80'],
    [/sembilan\s*puluh/g, '90'],
    [/satu/g, '1'],
    [/dua/g, '2'],
    [/tiga/g, '3'],
    [/empat/g, '4'],
    [/lima/g, '5'],
    [/enam/g, '6'],
    [/tujuh/g, '7'],
    [/delapan/g, '8'],
    [/sembilan/g, '9'],
  ];

  wordToNumMap.forEach(([regex, replacement]) => {
    cleanedText = cleanedText.replace(regex, replacement);
  });

  // Extract Harga Jual / Harga Beli (price)
  let price = 0;
  const thousandRegex = /(\d+)\s*ribu/i;
  const millionRegex = /(\d+)\s*juta/i;
  const hundredRegex = /(\d+)\s*ratus/i;
  const rawNumRegex = /(\d{4,})/i;

  const thousandMatch = cleanedText.match(thousandRegex);
  const millionMatch = cleanedText.match(millionRegex);
  const hundredMatch = cleanedText.match(hundredRegex);
  const rawNumMatch = cleanedText.match(rawNumRegex);

  if (thousandMatch) {
    price = parseInt(thousandMatch[1]) * 1000;
  } else if (millionMatch) {
    price = parseInt(millionMatch[1]) * 1000000;
  } else if (hundredMatch) {
    price = parseInt(hundredMatch[1]) * 100;
  } else if (rawNumMatch) {
    price = parseInt(rawNumMatch[1]);
  }

  // 4. Parse HPP (modal) for sales
  let hpp = 0;
  if (type === 'pemasukan') {
    const modalMatch = cleanedText.match(/(?:modal|pokok|beli)\s*(?:sebesar)?\s*(\d+)\s*(ribu|juta)?/i);
    if (modalMatch) {
      const base = parseInt(modalMatch[1]);
      const unit = modalMatch[2] ? modalMatch[2].toLowerCase() : '';
      if (unit === 'ribu') {
        hpp = base * 1000;
      } else if (unit === 'juta') {
        hpp = base * 1000000;
      } else {
        hpp = base;
      }
    }
  }

  // 5. Parse product name & clean text
  let productNameClean = lowercase;
  
  // Strip price/modal details
  productNameClean = productNameClean.replace(/(?:harga|seharga|total|bayar|nominal|rupiah)/gi, '');
  productNameClean = productNameClean.replace(/(?:porsi|gelas|pax|buah|biji|pcs|ikat|piring|mangkuk|kg|bungkus|liter|karung|jasa|orang)/gi, '');
  productNameClean = productNameClean.replace(/(?:modal|pokok|beli)\s*(?:sebesar)?\s*\d+\s*(?:ribu|juta)?/gi, '');
  productNameClean = productNameClean.replace(/(?:modal|pokok|beli)\s*(?:sebesar)?\s*(?:satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh)\s*(?:ribu|juta)?/gi, '');
  
  Object.keys(numberWords).forEach((word) => {
    productNameClean = productNameClean.replace(new RegExp('\\b' + word + '\\b', 'gi'), '');
  });
  productNameClean = productNameClean.replace(/\d+/g, '');
  productNameClean = productNameClean.replace(/\b(?:beli|pesan|catat|tambah|ada|transaksi|jual|laku|belanja|gaji|sewa|bayar)\b/gi, '');
  productNameClean = productNameClean.replace(/\s+/g, ' ').trim();

  if (productNameClean) {
    productNameClean = productNameClean
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.substring(1))
      .join(' ');
  } else {
    productNameClean = type === 'pemasukan' ? 'Penjualan Baru' : 'Belanja Baru';
  }

  // Category mapping
  let category = 'Lainnya';
  const lowerProd = productNameClean.toLowerCase();
  
  if (type === 'pemasukan') {
    const foodKeywords = ['nasi', 'goreng', 'mie', 'bakso', 'sate', 'roti', 'ayam', 'ikan', 'makan', 'soto', 'martabak', 'pempek', 'burger', 'pizza'];
    const drinkKeywords = ['kopi', 'teh', 'susu', 'jus', 'es', 'drink', 'coffee', 'tea', 'milk', 'boba', 'cendol', 'sirup', 'air'];
    const serviceKeywords = ['potong', 'cukur', 'salon', 'spa', 'pijat', 'cuci', 'servis', 'jasa', 'sewa', 'clean'];
    const goodsKeywords = ['sabun', 'beras', 'telur', 'minyak', 'gula', 'buku', 'baju', 'kaos', 'sepatu', 'tas', 'sembako'];

    if (foodKeywords.some((kw) => lowerProd.includes(kw))) {
      category = 'Makanan';
    } else if (drinkKeywords.some((kw) => lowerProd.includes(kw))) {
      category = 'Minuman';
    } else if (serviceKeywords.some((kw) => lowerProd.includes(kw))) {
      category = 'Jasa';
    } else if (goodsKeywords.some((kw) => lowerProd.includes(kw))) {
      category = 'Barang';
    }
  } else {
    const rawMaterialKeywords = ['beras', 'minyak', 'telur', 'daging', 'sayur', 'kopi', 'gula', 'susu', 'tepung', 'bumbu'];
    const rentalKeywords = ['sewa', 'kontrak', 'ruko', 'kios', 'lapak'];
    const salaryKeywords = ['gaji', 'karyawan', 'upah', 'staf', 'bonus'];
    const utilityKeywords = ['listrik', 'air', 'pdam', 'internet', 'pulsa', 'wifi', 'gas'];

    if (rawMaterialKeywords.some((kw) => lowerProd.includes(kw))) {
      category = 'Bahan Baku';
    } else if (rentalKeywords.some((kw) => lowerProd.includes(kw))) {
      category = 'Sewa';
    } else if (salaryKeywords.some((kw) => lowerProd.includes(kw))) {
      category = 'Gaji';
    } else if (utilityKeywords.some((kw) => lowerProd.includes(kw))) {
      category = 'Operasional'; // Fallback / Utility
    }
  }

  return {
    type,
    name: productNameClean,
    quantity: qty,
    price,
    hpp: type === 'pemasukan' ? hpp : 0,
    category,
  };
};

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[isDark ? 'dark' : 'light'];

  const { addTransaction } = useTransactionStore();

  // STT States
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [sttError, setSttError] = useState<string | null>(null);

  // Form States
  const [type, setType] = useState<'pemasukan' | 'pengeluaran'>('pemasukan');
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('0');
  const [hpp, setHpp] = useState('0');
  const [category, setCategory] = useState<string>('Lainnya');

  const handleTypeChange = (newType: 'pemasukan' | 'pengeluaran') => {
    setType(newType);
    setCategory('Lainnya');
  };

  // Voice NLP Parser Logic
  const handleParseAndFillForm = useCallback((text: string) => {
    const parsed = parseVoiceText(text);
    setType(parsed.type);
    setProductName(parsed.name);
    setQuantity(parsed.quantity.toString());
    setPrice(parsed.price.toString());
    setHpp(parsed.hpp.toString());
    setCategory(parsed.category);
  }, []);

  // Web Speech API Event Listeners
  useEffect(() => {
    if (Platform.OS === 'web' && recognition) {
      recognition.onstart = () => {
        setIsRecording(true);
        setSttError(null);
      };

      recognition.onresult = (event: any) => {
        const speechToText = event.results[0][0].transcript;
        setTranscript(speechToText);
        handleParseAndFillForm(speechToText);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setSttError(`Error: ${event.error}. Pastikan izin mikrofon diberikan.`);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };
    }
  }, [handleParseAndFillForm]);

  const startSpeechToText = () => {
    if (Platform.OS === 'web') {
      if (recognition) {
        try {
          if (isRecording) {
            recognition.stop();
          } else {
            setTranscript('');
            recognition.start();
          }
        } catch (e) {
          console.error(e);
        }
      } else {
        setSttError('Perekaman suara tidak didukung di browser ini. Gunakan Chrome/Safari.');
      }
    } else {
      setSttError(
        'Perekaman suara native memerlukan Development Build. Gunakan tombol simulasi di bawah untuk menguji fitur ini.'
      );
    }
  };

  const handleSaveTransaction = () => {
    if (!productName.trim()) return;

    const qtyNum = parseInt(quantity) || 1;
    const priceNum = parseInt(price) || 0;
    const hppNum = type === 'pemasukan' ? (parseInt(hpp) || 0) : 0;

    addTransaction({
      type,
      name: productName,
      quantity: qtyNum,
      price: priceNum,
      hpp: hppNum,
      category,
    });

    // Reset Form States
    setProductName('');
    setQuantity('1');
    setPrice('0');
    setHpp('0');
    setCategory('Lainnya');
    setTranscript('');
    setSttError(null);

    // Redirect to History tab
    router.push('/history');
  };

  const totalCalculated = (parseInt(quantity) || 1) * (parseInt(price) || 0);

  const categoriesToRender = type === 'pemasukan' ? PEMASUKAN_CATEGORIES : PENGELUARAN_CATEGORIES;
  const simulationList = type === 'pemasukan' ? MOCK_PEMASUKAN : MOCK_PENGELUARAN;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.half }}>
              <ThemedText type="title">Catat Kas Buku</ThemedText>
              <Feather name="book-open" size={24} color={colors.primary} />
            </View>
            <ThemedText themeColor="textSecondary">
              Rekam dan kelola pemasukan, pengeluaran belanja, dan kalkulasi HPP dengan mudah.
            </ThemedText>
          </View>

          {/* Switcher Tipe */}
          <View style={styles.typeContainer}>
            <Pressable
              onPress={() => handleTypeChange('pemasukan')}
              style={[
                styles.typeBtn,
                type === 'pemasukan'
                  ? { backgroundColor: colors.primary }
                  : { backgroundColor: colors.backgroundSelected },
                { borderTopLeftRadius: BorderRadius.medium, borderBottomLeftRadius: BorderRadius.medium },
              ]}
            >
              <Text style={[styles.typeBtnText, { color: type === 'pemasukan' ? '#ffffff' : colors.text }]}>
                Penjualan 🟢
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleTypeChange('pengeluaran')}
              style={[
                styles.typeBtn,
                type === 'pengeluaran'
                  ? { backgroundColor: colors.primary }
                  : { backgroundColor: colors.backgroundSelected },
                { borderTopRightRadius: BorderRadius.medium, borderBottomRightRadius: BorderRadius.medium },
              ]}
            >
              <Text style={[styles.typeBtnText, { color: type === 'pengeluaran' ? '#ffffff' : colors.text }]}>
                Belanja Toko 🔴
              </Text>
            </Pressable>
          </View>

          {/* STT Section */}
          <ThemedView type="backgroundElement" style={styles.sttSection}>
            <View style={styles.microphoneWrapper}>
              <Pressable
                onPress={startSpeechToText}
                style={({ pressed }) => [
                  styles.microphoneButton,
                  { backgroundColor: isRecording ? '#ef4444' : colors.primary },
                  pressed && styles.buttonPressed,
                ]}
              >
                <Feather name={isRecording ? 'square' : 'mic'} size={32} color="#ffffff" />
              </Pressable>
              <ThemedText type="smallBold" style={styles.sttStatus}>
                {isRecording ? 'Mendengarkan... Tap untuk berhenti' : 'Tap Mikrofon untuk Bicara'}
              </ThemedText>
              {Platform.OS !== 'web' && (
                <Text style={styles.webWarning}>
                  *Fitur STT native memerlukan Dev Build. Silakan pakai simulasi tombol di bawah.
                </Text>
              )}
            </View>

            {transcript ? (
              <View style={styles.transcriptBox}>
                <ThemedText type="smallBold" themeColor="textSecondary">Hasil Suara:</ThemedText>
                <Text style={[styles.transcriptText, { color: colors.text }]}>{"\""}{transcript}{"\""}</Text>
              </View>
            ) : null}

            {sttError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{sttError}</Text>
              </View>
            ) : null}
          </ThemedView>

          {/* Simulation Section */}
          <View style={styles.simulationContainer}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.simTitle}>
              Simulasi Suara ({type === 'pemasukan' ? 'Penjualan' : 'Belanja'})
            </ThemedText>
            <View style={styles.simPills}>
              {simulationList.map((ex, idx) => (
                <Pressable
                  key={idx}
                  onPress={() => {
                    setTranscript(ex.text);
                    handleParseAndFillForm(ex.text);
                  }}
                  style={({ pressed }) => [
                    styles.simPill,
                    { backgroundColor: colors.backgroundSelected },
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text style={[styles.simPillText, { color: colors.text }]}>{ex.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Transaction Form confirmation */}
          <ThemedView type="backgroundElement" style={styles.formContainer}>
            <ThemedText type="subtitle" style={styles.formTitle}>
              Konfirmasi Catatan {type === 'pemasukan' ? '(Penjualan)' : '(Belanja)'}
            </ThemedText>
            
            <View style={styles.formField}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                {type === 'pemasukan' ? 'Nama Produk' : 'Nama Pengeluaran / Barang'}
              </ThemedText>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.backgroundSelected }]}
                placeholder={type === 'pemasukan' ? 'cth: Nasi Goreng' : 'cth: Minyak Goreng Bimoli'}
                placeholderTextColor={colors.textSecondary}
                value={productName}
                onChangeText={setProductName}
              />
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formField, { flex: 1 }]}>
                <ThemedText type="smallBold" themeColor="textSecondary">Jumlah (Qty)</ThemedText>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.backgroundSelected }]}
                  keyboardType="numeric"
                  value={quantity}
                  onChangeText={setQuantity}
                />
              </View>
              <View style={[styles.formField, { flex: 2 }]}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {type === 'pemasukan' ? 'Harga Jual Satuan (Rp)' : 'Biaya Satuan (Rp)'}
                </ThemedText>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.backgroundSelected }]}
                  keyboardType="numeric"
                  value={price}
                  onChangeText={setPrice}
                />
              </View>
            </View>

            {type === 'pemasukan' && (
              <View style={styles.formField}>
                <ThemedText type="smallBold" themeColor="textSecondary">Harga Pokok / Modal (HPP Satuan - Rp)</ThemedText>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.backgroundSelected }]}
                  keyboardType="numeric"
                  placeholder="Opsional, cth: 10000"
                  placeholderTextColor={colors.textSecondary}
                  value={hpp}
                  onChangeText={setHpp}
                />
              </View>
            )}

            <View style={styles.formField}>
              <ThemedText type="smallBold" themeColor="textSecondary">Kategori</ThemedText>
              <View style={styles.categoryPills}>
                {categoriesToRender.map((catItem) => {
                  const isSelected = category === catItem;
                  return (
                    <Pressable
                      key={catItem}
                      onPress={() => setCategory(catItem)}
                      style={({ pressed }) => [
                        styles.catPill,
                        {
                          backgroundColor: isSelected
                            ? colors.primary
                            : colors.backgroundSelected,
                        },
                        pressed && styles.buttonPressed,
                      ]}
                    >
                      <Text style={[styles.catPillText, { color: isSelected ? '#ffffff' : colors.text }]}>
                        {catItem}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.totalRow}>
              <ThemedText type="subtitle">Estimasi Total</ThemedText>
              <ThemedText type="subtitle" style={[styles.totalValue, { color: type === 'pemasukan' ? '#22c55e' : '#ef4444' }]}>
                Rp{totalCalculated.toLocaleString('id-ID')}
              </ThemedText>
            </View>

            <Pressable
              onPress={handleSaveTransaction}
              disabled={!productName.trim()}
              style={({ pressed }) => [
                styles.saveButton,
                { backgroundColor: colors.accent },
                !productName.trim() ? styles.saveButtonDisabled : null,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.saveButtonText}>Simpan Transaksi Lokal</Text>
            </Pressable>
          </ThemedView>
        </ScrollView>
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
  scrollContent: {
    paddingBottom: BottomTabInset + Spacing.six,
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Platform.OS === 'web' ? 88 : Spacing.three,
    paddingBottom: Spacing.three,
  },
  typeContainer: {
    flexDirection: 'row',
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.four,
    height: 48,
  },
  typeBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeBtnText: {
    fontWeight: '800',
    fontSize: 14,
  },
  sttSection: {
    marginHorizontal: Spacing.four,
    padding: Spacing.four,
    borderRadius: BorderRadius.medium,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(128,128,128,0.12)',
  },
  microphoneWrapper: {
    alignItems: 'center',
    marginVertical: Spacing.two,
  },
  microphoneButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  sttStatus: {
    marginTop: Spacing.two,
    textAlign: 'center',
  },
  webWarning: {
    fontSize: 10,
    color: '#ef4444',
    textAlign: 'center',
    marginTop: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  transcriptBox: {
    width: '100%',
    backgroundColor: 'rgba(128, 128, 128, 0.06)',
    padding: Spacing.three,
    borderRadius: BorderRadius.medium,
    marginTop: Spacing.three,
  },
  transcriptText: {
    fontSize: 15,
    fontStyle: 'italic',
    marginTop: Spacing.half,
    lineHeight: 22,
  },
  errorBox: {
    width: '100%',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    padding: Spacing.two,
    borderRadius: BorderRadius.small,
    marginTop: Spacing.two,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    textAlign: 'center',
  },
  simulationContainer: {
    marginHorizontal: Spacing.four,
    marginTop: Spacing.four,
  },
  simTitle: {
    marginBottom: Spacing.two,
  },
  simPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  simPill: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.full,
  },
  simPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  formContainer: {
    marginHorizontal: Spacing.four,
    marginTop: Spacing.four,
    padding: Spacing.four,
    borderRadius: BorderRadius.medium,
    borderWidth: 1.5,
    borderColor: 'rgba(128,128,128,0.12)',
  },
  formTitle: {
    fontWeight: '800',
    marginBottom: Spacing.three,
  },
  formField: {
    marginBottom: Spacing.three,
  },
  formRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: BorderRadius.medium,
    paddingHorizontal: Spacing.three,
    height: 44,
    marginTop: Spacing.one,
    fontSize: 14,
    fontWeight: '600',
  },
  categoryPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  catPill: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.one,
    borderRadius: BorderRadius.full,
    height: 32,
    justifyContent: 'center',
  },
  catPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: Spacing.three,
    paddingTop: Spacing.two,
    borderTopWidth: 1.5,
    borderColor: 'rgba(128,128,128,0.12)',
  },
  totalValue: {
    fontWeight: '800',
  },
  saveButton: {
    paddingVertical: Spacing.three,
    borderRadius: BorderRadius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 15,
  },
  buttonPressed: {
    opacity: 0.8,
  },
});
