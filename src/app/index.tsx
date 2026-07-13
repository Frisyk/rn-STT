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

const CATEGORIES = ['Makanan', 'Minuman', 'Barang', 'Jasa', 'Lainnya'] as const;

// Mock speech examples for testing in Expo Go
const MOCK_EXAMPLES = [
  { text: 'Nasi goreng dua porsi harga lima belas ribu', label: '🍽️ Nasi Goreng (2 x Rp15.000)' },
  { text: 'Kopi susu gula aren tiga gelas seharga sepuluh ribu', label: '☕ Kopi Susu (3 x Rp10.000)' },
  { text: 'Beras pandan wangi satu karung harga seratus dua puluh ribu', label: '🛒 Beras (1 x Rp120.000)' },
  { text: 'Potong rambut pria satu jasa harga lima puluh ribu', label: '🛠️ Potong Rambut (1 x Rp50.000)' },
];

// Parser helper function
const parseVoiceText = (text: string) => {
  const lowercase = text.toLowerCase();
  
  // 1. Parse quantity
  const numberWords: { [key: string]: number } = {
    satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10
  };

  let qty = 1;
  const qtyRegex = /(?:(\d+)|(satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh))\s*(porsi|gelas|pax|buah|biji|pcs|ikat|piring|mangkuk|kg|bungkus)/i;
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

  // 2. Parse price/money
  let parsedPrice = 0;
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

  const thousandRegex = /(\d+)\s*ribu/i;
  const millionRegex = /(\d+)\s*juta/i;
  const hundredRegex = /(\d+)\s*ratus/i;
  const rawNumRegex = /(\d{4,})/i;

  const thousandMatch = cleanedText.match(thousandRegex);
  const millionMatch = cleanedText.match(millionRegex);
  const hundredMatch = cleanedText.match(hundredRegex);
  const rawNumMatch = cleanedText.match(rawNumRegex);

  if (thousandMatch) {
    parsedPrice = parseInt(thousandMatch[1]) * 1000;
  } else if (millionMatch) {
    parsedPrice = parseInt(millionMatch[1]) * 1000000;
  } else if (hundredMatch) {
    parsedPrice = parseInt(hundredMatch[1]) * 100;
  } else if (rawNumMatch) {
    parsedPrice = parseInt(rawNumMatch[1]);
  }

  // 3. Parse product name
  let productNameClean = lowercase;
  productNameClean = productNameClean.replace(/(?:harga|seharga|total|bayar|nominal|rupiah)/gi, '');
  productNameClean = productNameClean.replace(/(?:porsi|gelas|pax|buah|biji|pcs|ikat|piring|mangkuk|kg|bungkus)/gi, '');
  Object.keys(numberWords).forEach((word) => {
    productNameClean = productNameClean.replace(new RegExp('\\b' + word + '\\b', 'gi'), '');
  });
  productNameClean = productNameClean.replace(/\d+/g, '');
  productNameClean = productNameClean.replace(/\b(?:beli|pesan|catat|tambah|ada|transaksi)\b/gi, '');
  productNameClean = productNameClean.replace(/\s+/g, ' ').trim();

  if (productNameClean) {
    productNameClean = productNameClean
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.substring(1))
      .join(' ');
  } else {
    productNameClean = 'Transaksi Baru';
  }

  // Kategori mapping
  let cat: typeof CATEGORIES[number] = 'Lainnya';
  const foodKeywords = ['nasi', 'goreng', 'mie', 'bakso', 'sate', 'roti', 'ayam', 'ikan', 'makan', 'soto', 'martabak', 'pempek', 'burger', 'pizza'];
  const drinkKeywords = ['kopi', 'teh', 'susu', 'jus', 'es', 'drink', 'coffee', 'tea', 'milk', 'boba', 'cendol', 'sirup', 'air'];
  const serviceKeywords = ['potong', 'cukur', 'salon', 'spa', 'pijat', 'cuci', 'servis', 'jasa', 'sewa', 'clean'];
  const goodsKeywords = ['sabun', 'beras', 'telur', 'minyak', 'gula', 'buku', 'baju', 'kaos', 'sepatu', 'tas', 'sembako'];

  const lowerProd = productNameClean.toLowerCase();
  if (foodKeywords.some((kw) => lowerProd.includes(kw))) {
    cat = 'Makanan';
  } else if (drinkKeywords.some((kw) => lowerProd.includes(kw))) {
    cat = 'Minuman';
  } else if (serviceKeywords.some((kw) => lowerProd.includes(kw))) {
    cat = 'Jasa';
  } else if (goodsKeywords.some((kw) => lowerProd.includes(kw))) {
    cat = 'Barang';
  }

  return {
    name: productNameClean,
    quantity: qty,
    price: parsedPrice,
    category: cat,
  };
};

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[isDark ? 'dark' : 'light'];

  const { addTransaction } = useTransactionStore();

  // STT Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [sttError, setSttError] = useState<string | null>(null);

  // Form States (pre-filled by parser or manually edited)
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('0');
  const [category, setCategory] = useState<typeof CATEGORIES[number]>('Lainnya');

  // Voice NLP Parser Logic
  const handleParseAndFillForm = useCallback((text: string) => {
    const parsed = parseVoiceText(text);
    setProductName(parsed.name);
    setQuantity(parsed.quantity.toString());
    setPrice(parsed.price.toString());
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

    addTransaction({
      name: productName,
      quantity: qtyNum,
      price: priceNum,
      category,
    });

    // Reset Form States
    setProductName('');
    setQuantity('1');
    setPrice('0');
    setCategory('Lainnya');
    setTranscript('');
    setSttError(null);

    // Redirect to History tab
    router.push('/history');
  };

  const totalCalculated = (parseInt(quantity) || 1) * (parseInt(price) || 0);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <ThemedText type="title">Catat Penjualan 🎙️</ThemedText>
            <ThemedText themeColor="textSecondary">
              Gunakan suara untuk merekam transaksi penjualan dengan instan.
            </ThemedText>
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
                <Text style={styles.micIcon}>{isRecording ? '🛑' : '🎙️'}</Text>
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
              Simulasi Suara (Untuk Uji Coba)
            </ThemedText>
            <View style={styles.simPills}>
              {MOCK_EXAMPLES.map((ex, idx) => (
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
            <ThemedText type="subtitle" style={styles.formTitle}>Konfirmasi Catatan</ThemedText>
            
            <View style={styles.formField}>
              <ThemedText type="smallBold" themeColor="textSecondary">Nama Produk</ThemedText>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.backgroundSelected }]}
                placeholder="cth: Nasi Goreng"
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
                <ThemedText type="smallBold" themeColor="textSecondary">Harga Satuan (Rp)</ThemedText>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.backgroundSelected }]}
                  keyboardType="numeric"
                  value={price}
                  onChangeText={setPrice}
                />
              </View>
            </View>

            <View style={styles.formField}>
              <ThemedText type="smallBold" themeColor="textSecondary">Kategori</ThemedText>
              <View style={styles.categoryPills}>
                {CATEGORIES.map((catItem) => {
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
              <ThemedText type="subtitle" style={[styles.totalValue, { color: colors.primary }]}>
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
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
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
  micIcon: {
    fontSize: 32,
    color: '#ffffff',
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
