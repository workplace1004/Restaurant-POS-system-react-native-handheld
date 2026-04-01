import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Switch, ActivityIndicator, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import { useApi } from '../contexts/ApiContext';
import { useLanguage } from '../contexts/LanguageContext';

const TOAST_DURATION_MS = 3500;
/** Abort fetch if the server does not respond (avoids long hangs on wrong IP/port). */
const CONNECT_TIMEOUT_MS = 3000;
const MAX_HOST_LEN = 128;
const MIN_PORT = 1;
const MAX_PORT = 65535;

function readExtra() {
  return Constants.expoConfig?.extra ?? {};
}

/** Parsed saved origin, or defaults: dev emulator uses 10.0.2.2; release uses app.json extra or empty host (real device). */
function getServerFormDefaults(socketOrigin) {
  const raw = socketOrigin && String(socketOrigin).trim();
  if (raw) {
    try {
      const u = new URL(raw.startsWith('http') ? raw : `http://${raw}`);
      const defaultPort = u.protocol === 'https:' ? '443' : '80';
      return {
        host: u.hostname,
        port: u.port ? String(u.port) : defaultPort,
        https: u.protocol === 'https:',
      };
    } catch {
      /* fall through */
    }
  }
  const extra = readExtra();
  const extraHost = String(extra.defaultServerHost ?? '').trim();
  const extraPort = String(extra.defaultServerPort ?? '5000').trim();
  const extraHttps = Boolean(extra.defaultServerHttps);
  if (__DEV__) {
    return { host: '10.0.2.2', port: extraPort || '5000', https: false };
  }
  return {
    host: extraHost,
    port: extraPort || '5000',
    https: extraHttps,
  };
}

/**
 * @param {{ onClose?: () => void }} [props] — When set (e.g. opened from login), shows Back and calls onClose after successful connect.
 */
export function ServerConfigScreen({ onClose } = {}) {
  const { setApiBase, socketOrigin } = useApi();
  const { t } = useLanguage();
  const initial = getServerFormDefaults('');
  const [host, setHost] = useState(initial.host);
  const [port, setPort] = useState(initial.port);
  const [https, setHttps] = useState(initial.https);
  const [validationErr, setValidationErr] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const d = getServerFormDefaults(socketOrigin);
    setHost(d.host);
    setPort(d.port);
    setHttps(d.https);
  }, [socketOrigin]);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(id);
  }, [toast]);

  const save = async () => {
    const h = String(host || '').trim();
    const p = String(port || '').trim();
    if (!h) {
      setValidationErr(t('handheldServerHostRequired'));
      return;
    }
    if (h.length > MAX_HOST_LEN) {
      setValidationErr(t('handheldServerHostTooLong'));
      return;
    }
    if (!p) {
      setValidationErr(t('handheldServerPortRequired'));
      return;
    }
    const portNum = parseInt(p, 10);
    if (!/^\d+$/.test(p) || Number.isNaN(portNum) || portNum < MIN_PORT || portNum > MAX_PORT) {
      setValidationErr(t('handheldServerPortInvalid'));
      return;
    }
    setValidationErr('');
    setToast(null);
    setConnecting(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS);
    try {
      const scheme = https ? 'https' : 'http';
      const baseNoSlash = `${scheme}://${h}:${portNum}`.replace(/\/$/, '');
      const apiUrl = baseNoSlash.endsWith('/api') ? baseNoSlash : `${baseNoSlash}/api`;
      const ping = await fetch(`${apiUrl}/categories`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!ping.ok) throw new Error(`HTTP ${ping.status}`);
      await setApiBase(baseNoSlash);
      onClose?.();
    } catch {
      clearTimeout(timeoutId);
      setToast({ message: t('handheldServerConnectionFailed'), isError: true });
    } finally {
      setConnecting(false);
    }
  };

  return (
    <View className="flex-1 bg-pos-bg px-6 pt-14 pb-8 justify-center" style={{ position: 'relative' }}>
      {onClose ? (
        <Pressable
          className="mb-6 self-start rounded-lg bg-pos-panel px-3 py-2 active:opacity-80"
          disabled={connecting}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('handheldServerBack')}
        >
          <Text className="text-pos-text text-base font-medium">{t('handheldServerBack')}</Text>
        </Pressable>
      ) : null}

      <Text className="text-pos-text text-2xl font-semibold mb-6">{t('handheldServerTitle')}</Text>

      <Text className="text-pos-text mb-2">{t('handheldServerHost')}</Text>
      <TextInput
        value={host}
        onChangeText={(text) => setHost(text.slice(0, MAX_HOST_LEN))}
        editable={!connecting}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={MAX_HOST_LEN}
        placeholder="192.168.1.10"
        placeholderTextColor="#7f8c8d"
        className={`bg-pos-panel border border-pos-border rounded-lg px-4 py-3 text-pos-text text-lg mb-4 ${connecting ? 'opacity-60' : ''}`}
      />

      <Text className="text-pos-text mb-2">{t('handheldServerPort')}</Text>
      <TextInput
        value={port}
        onChangeText={(text) => setPort(text.replace(/\D/g, '').slice(0, 5))}
        editable={!connecting}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="number-pad"
        maxLength={5}
        placeholder="5000"
        placeholderTextColor="#7f8c8d"
        className={`bg-pos-panel border border-pos-border rounded-lg px-4 py-3 text-pos-text text-lg mb-4 ${connecting ? 'opacity-60' : ''}`}
      />

      <View className={`mb-6 flex-row items-center justify-between rounded-lg border border-pos-border bg-pos-panel px-4 py-3 ${connecting ? 'opacity-60' : ''}`}>
        <Text className="text-pos-text text-base">{t('handheldServerHttps')}</Text>
        <Switch value={https} onValueChange={setHttps} disabled={connecting} trackColor={{ false: '#34495e', true: '#22c55e' }} thumbColor="#ecf0f1" />
      </View>

      {validationErr ? <Text className="text-red-400 mb-4">{validationErr}</Text> : null}

      <Pressable
        className={`bg-green-600 py-4 rounded-lg items-center justify-center active:opacity-90 ${connecting ? 'opacity-90' : ''}`}
        disabled={connecting}
        onPress={save}
      >
        {connecting ? (
          <View className="flex-row items-center gap-3">
            <ActivityIndicator color="#ffffff" />
            <Text className="text-white text-center text-xl font-semibold">{t('handheldServerConnecting')}</Text>
          </View>
        ) : (
          <Text className="text-white text-center text-xl font-semibold">{t('handheldServerConnect')}</Text>
        )}
      </Pressable>

      {toast ? (
        <View pointerEvents="box-none" style={[StyleSheet.absoluteFillObject, { zIndex: 100 }]}>
          <View className="absolute left-0 right-0 top-14 items-center px-4" pointerEvents="box-none">
            <Pressable
              className={`max-w-[90%] rounded-xl border px-4 py-3 shadow-lg ${toast.isError ? 'border-rose-600 bg-rose-500' : 'border-white/10 bg-gray-900'}`}
              onPress={() => setToast(null)}
            >
              <Text className="text-center text-base text-white">{toast.message}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}
