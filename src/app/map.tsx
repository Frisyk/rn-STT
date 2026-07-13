import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Platform,
  useColorScheme,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing, MaxContentWidth, BorderRadius } from '@/constants/theme';
import { UMKM_LIST } from '@/constants/umkmData';

// Dynamic import for WebView to prevent compilation crashes on web platform
let WebView: any = null;
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    WebView = require('react-native-webview').WebView;
  } catch (e) {
    console.warn('WebView package not loaded:', e);
  }
}

// Center of Jakarta Monas
const DEFAULT_LAT = -6.175392;
const DEFAULT_LNG = 106.827153;

export default function MapScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[isDark ? 'dark' : 'light'];

  const params = useLocalSearchParams<{ lat?: string; lng?: string; id?: string }>();
  
  const latParam = params.lat ? parseFloat(params.lat) : DEFAULT_LAT;
  const lngParam = params.lng ? parseFloat(params.lng) : DEFAULT_LNG;
  const targetId = params.id || null;

  const mapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <title>OpenStreetMap UMKM</title>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <style>
        html, body, #map {
          height: 100%;
          margin: 0;
          padding: 0;
          background-color: ${isDark ? '#111827' : '#f0f0f3'};
        }
        .leaflet-popup-content-wrapper {
          border-radius: 12px;
          font-family: system-ui, -apple-system, sans-serif;
          padding: 8px;
          background-color: ${isDark ? '#1f2937' : '#ffffff'};
          color: ${isDark ? '#ffffff' : '#111827'};
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
        .leaflet-popup-tip {
          background-color: ${isDark ? '#1f2937' : '#ffffff'};
        }
        .popup-title {
          font-weight: bold;
          font-size: 15px;
          margin-bottom: 4px;
          color: ${isDark ? '#38bdf8' : '#4f46e5'};
        }
        .popup-category {
          display: inline-block;
          background: ${isDark ? '#3730a3' : '#e0e7ff'};
          color: ${isDark ? '#c7d2fe' : '#4f46e5'};
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 12px;
          font-weight: bold;
          margin-bottom: 6px;
        }
        .popup-desc {
          font-size: 12px;
          color: ${isDark ? '#d1d5db' : '#4b5563'};
          line-height: 1.4;
          margin-bottom: 6px;
        }
        .popup-rating {
          color: #eab308;
          font-weight: bold;
          font-size: 12px;
          display: flex;
          align-items: center;
        }
        
        /* Dark mode map stylesheet adjustments */
        ${isDark ? `
        .leaflet-tile-container {
          filter: invert(100%) hue-rotate(180deg) brightness(85%) contrast(85%);
        }
        ` : ''}
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script>
        const uMKMs = ${JSON.stringify(UMKM_LIST)};
        const centerLat = ${latParam};
        const centerLng = ${lngParam};
        const targetId = ${targetId ? `'${targetId}'` : 'null'};

        // Initialize Map
        const map = L.map('map', {
          zoomControl: true,
          attributionControl: false
        }).setView([centerLat, centerLng], targetId ? 16 : 14);

        // Load OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19
        }).addTo(map);

        const markers = {};

        // Add Markers
        uMKMs.forEach(umkm => {
          // Custom icon styling for premium feel
          const marker = L.marker([umkm.latitude, umkm.longitude]).addTo(map);
          
          const popupContent = \`
            <div class="popup-title">\${umkm.name}</div>
            <span class="popup-category">\${umkm.category}</span>
            <div class="popup-desc">\${umkm.description}</div>
            <div class="popup-rating">⭐ \${umkm.rating.toFixed(1)}</div>
          \`;
          
          marker.bindPopup(popupContent);
          markers[umkm.id] = marker;

          // Open target popup
          if (targetId && umkm.id === targetId) {
            setTimeout(() => {
              marker.openPopup();
            }, 300);
          }
        });
      </script>
    </body>
    </html>
  `;

  const resetTargetLocation = () => {
    router.replace({ pathname: '/map' });
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <ThemedText type="title">Peta UMKM 📍</ThemedText>
            {targetId && (
              <Pressable
                onPress={resetTargetLocation}
                style={({ pressed }) => [
                  styles.resetButton,
                  { backgroundColor: colors.backgroundSelected },
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={[styles.resetButtonText, { color: colors.text }]}>Tampilkan Semua</Text>
              </Pressable>
            )}
          </View>
          <ThemedText themeColor="textSecondary">
            {targetId
              ? `Menampilkan lokasi ${UMKM_LIST.find((u) => u.id === targetId)?.name}`
              : 'Gunakan peta interaktif OpenStreetMap untuk mencari lokasi toko'}
          </ThemedText>
        </View>

        {/* Map View */}
        <View style={[styles.mapContainer, { borderColor: colors.backgroundSelected }]}>
          {Platform.OS === 'web' ? (
            <iframe
              srcDoc={mapHtml}
              style={styles.webMap}
              title="OpenStreetMap UMKM"
            />
          ) : WebView ? (
            <WebView
              originWhitelist={['*']}
              source={{ html: mapHtml }}
              style={styles.nativeMap}
              javaScriptEnabled={true}
              domStorageEnabled={true}
            />
          ) : (
            <View style={styles.errorContainer}>
              <Text style={{ color: colors.text }}>
                WebView tidak terpasang atau tidak didukung di platform ini.
              </Text>
            </View>
          )}
        </View>
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
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resetButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: BorderRadius.full, // Highly rounded pill
  },
  resetButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  mapContainer: {
    flex: 1,
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.four,
    borderRadius: BorderRadius.medium, // Rounded container
    overflow: 'hidden',
    borderWidth: 1.5,
  },
  webMap: {
    width: '100%',
    height: '100%',
    border: 'none',
  },
  nativeMap: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  buttonPressed: {
    opacity: 0.8,
  },
});
