import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLanguage } from '../contexts/LanguageContext';
import { useApi } from '../contexts/ApiContext';

const LOGIN_LOGO = require('../../assets/image/logo.png');

const TOAST_DURATION_MS = 3500;
const PIN_DEBOUNCE_MS = 200;
const PIN_LENGTH = 4;

export function LoginScreen({ onLogin, onOpenServerConfig }) {
  const { t } = useLanguage();
  const { apiBase } = useApi();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userPickerOpen, setUserPickerOpen] = useState(false);
  const [pinError, setPinError] = useState(false);
  const loginInFlight = useRef(false);

  useEffect(() => {
    if (!apiBase) {
      setUsers([]);
      setSelectedUser(null);
      setPinInput('');
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch('/api/users');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setUsers(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) {
          setUsers([]);
          setToast({ message: t('handheldLoginBackendUnavailable'), isError: true });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBase, t]);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(id);
  }, [toast]);

  const showToast = useCallback((message, isError = true) => {
    setToast({ message, isError });
  }, []);

  const loginWithPin = useCallback(
    async (user, pin) => {
      if (!user || loginInFlight.current) return;
      const digits = String(pin || '').replace(/\D/g, '');
      if (digits.length !== PIN_LENGTH) return;

      loginInFlight.current = true;
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, pin: digits }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          showToast(data.error || t('loginWrongPin'));
          setPinInput('');
          setPinError(true);
          return;
        }
        setPinError(false);
        onLogin?.(data);
      } catch {
        showToast(t('loginFailed'));
        setPinInput('');
        setPinError(true);
      } finally {
        loginInFlight.current = false;
      }
    },
    [onLogin, showToast, t],
  );

  useEffect(() => {
    if (!selectedUser) return;
    const digits = pinInput.replace(/\D/g, '');
    if (digits.length !== PIN_LENGTH) return;

    const id = setTimeout(() => {
      void loginWithPin(selectedUser, digits);
    }, PIN_DEBOUNCE_MS);

    return () => clearTimeout(id);
  }, [pinInput, selectedUser, loginWithPin]);

  const needsServer = !apiBase;
  const dropdownLabel = loading
    ? t('loginLoadingUsers')
    : needsServer
      ? t('handheldLoginSetServerFirst')
      : users.length === 0
        ? t('loginNoUsers')
        : selectedUser
          ? selectedUser.label || selectedUser.name || String(selectedUser.id)
          : t('loginSelectUser');
  const canOpenPicker = !needsServer && !loading && users.length > 0;

  return (
    <View className="flex-1 flex-col bg-pos-bg" style={{ position: 'relative' }}>
      <View className="flex-1 items-center mt-20 px-6">
        <View className="w-full max-w-md">
          <View className="mb-6 w-full items-center">
            <ExpoImage
              source={LOGIN_LOGO}
              style={{ width: '100%', maxWidth: 550, height: 350 }}
              contentFit="contain" 
              accessibilityIgnoresInvertColors
            />
          </View>
          <Pressable
            className="mb-[20px] w-full min-h-[56px] flex-row items-center justify-center gap-2 rounded-xl border-2 border-pos-border bg-pos-panel px-4 py-4 active:bg-green-500"
            onPress={() => onOpenServerConfig?.()}
            accessibilityRole="button"
            accessibilityLabel={t('handheldLoginConfiguration')}
          >
            <MaterialCommunityIcons name="cog-outline" size={22} color="#ecf0f1" />
            <Text className="text-center text-lg font-semibold text-white">{t('handheldLoginConfiguration')}</Text>
          </Pressable>
          <View className="relative z-10 w-full overflow-visible">
            <Pressable
              disabled={!canOpenPicker}
              className={`relative z-10 w-full min-h-[56px] justify-center rounded-xl border-2 border-pos-border bg-pos-panel px-10 py-4 ${canOpenPicker ? 'active:opacity-90' : 'opacity-60'}`}
              onPress={() => setUserPickerOpen((prev) => !prev)}
              accessibilityRole="button"
              accessibilityLabel={t('loginSelectUser')}
            >
              <Text className="text-center text-lg text-white" numberOfLines={2}>
                {dropdownLabel}
              </Text>
              {canOpenPicker ? (
                <View className="absolute right-4 top-0 bottom-0 justify-center" pointerEvents="none">
                  <Text className="text-lg text-white">▾</Text>
                </View>
              ) : null}
            </Pressable>
            {userPickerOpen && canOpenPicker ? (
              <View className="absolute left-0 right-0 top-full z-20 mt-2 max-h-[280px] overflow-hidden rounded-xl border-2 border-pos-border bg-pos-panel shadow-md">
                <ScrollView
                  className="max-h-[280px]"
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                >
                  {users.map((user) => {
                    const label = user.label || user.name || String(user.id);
                    return (
                      <Pressable
                        key={user.id}
                        className="border-b border-pos-border/50 px-4 py-4 active:bg-green-600/40"
                        onPress={() => {
                          setSelectedUser(user);
                          setPinInput('');
                          setPinError(false);
                          setUserPickerOpen(false);
                        }}
                      >
                        <Text className="text-lg font-medium text-white">{label}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}
          </View>

          <TextInput
            value={pinInput}
            onChangeText={(text) => {
              setPinError(false);
              setPinInput(text.replace(/\D/g, '').slice(0, PIN_LENGTH));
            }}
            editable={!!selectedUser && !loading}
            secureTextEntry
            keyboardType="number-pad"
            maxLength={PIN_LENGTH}
            placeholder={selectedUser ? '\u2022 \u2022 \u2022 \u2022' : ''}
            placeholderTextColor="#7f8c8d"
            className={`mt-4 w-full rounded-xl border-2 bg-pos-panel px-4 py-4 text-center text-2xl font-mono text-white ${pinError ? 'border-red-500' : 'border-pos-border'} ${!selectedUser ? 'opacity-50' : ''}`}
            style={{ letterSpacing: 14 }}
            accessibilityLabel={t('pin')}
          />
        </View>
      </View>

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
