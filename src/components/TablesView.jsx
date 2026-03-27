import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useLanguage } from '../contexts/LanguageContext';
import { LoadingSpinner } from './LoadingSpinner';

export function TablesView({
  tables = [],
  selectedTableId = null,
  onSelectTable,
  onBack,
  time,
  api = '/api'
}) {
  const { t } = useLanguage();
  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [selectedRoomIndex, setSelectedRoomIndex] = useState(0);
  const [showRoomsModal, setShowRoomsModal] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setRoomsLoading(true);
      try {
        const res = await fetch(`${api}/rooms`);
        const data = await res.json().catch(() => []);
        if (!alive) return;
        setRooms(Array.isArray(data) ? data : []);
      } catch {
        if (alive) setRooms([]);
      } finally {
        if (alive) setRoomsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [api]);

  const sortedRooms = useMemo(() => {
    if (!rooms.length) return [];
    const roomHasTables = (room) => {
      const roomId = room?.id != null ? String(room.id) : null;
      if (!roomId) return false;
      return tables.some((tb) => tb && String(tb?.roomId || '') === roomId);
    };
    const roomHasOpenOrders = (room) => {
      const roomId = room?.id != null ? String(room.id) : null;
      if (!roomId) return false;
      return tables.some((tb) => tb && String(tb?.roomId || '') === roomId && Array.isArray(tb?.orders) && tb.orders.length > 0);
    };
    return [...rooms].sort((a, b) => {
      const aHasTables = roomHasTables(a);
      const bHasTables = roomHasTables(b);
      if (aHasTables && !bHasTables) return -1;
      if (!aHasTables && bHasTables) return 1;
      const aHasOpen = roomHasOpenOrders(a);
      const bHasOpen = roomHasOpenOrders(b);
      if (aHasOpen && !bHasOpen) return -1;
      if (!aHasOpen && bHasOpen) return 1;
      return 0;
    });
  }, [rooms, tables]);

  const currentRoom = sortedRooms?.length > 0 ? sortedRooms[selectedRoomIndex % sortedRooms.length] : null;
  const locationId = currentRoom?.id != null ? String(currentRoom.id) : null;

  const tablesForCurrentRoom = useMemo(() => {
    if (!locationId) return [];
    return tables.filter((tb) => tb && tb.id != null && String(tb?.roomId || '') === String(locationId));
  }, [tables, locationId]);

  const handleSelectAndClose = (table, options) => {
    onSelectTable?.(table, options);
    onBack?.();
  };

  const showLoading = roomsLoading;

  if (showLoading) {
    return <LoadingSpinner label={t('loadingTables')} />;
  }

  return (
    <View className="flex-1 bg-pos-bg">
      <View className="px-4 py-4 bg-pos-bg flex-row justify-between items-center">
        <Text className="text-2xl text-pos-text">{time}</Text>
      </View>

      <ScrollView className="flex-1 bg-[#b0b0b0] p-4">
        <View className="flex-row flex-wrap justify-between">
          {tablesForCurrentRoom.map((tb) => {
            if (!tb?.id) return null;
            const id = String(tb.id);
            const tableNumber = String(tb?.name ?? id).replace(/^Table\s*/i, '') || id;
            const hasOpenOrders = Array.isArray(tb?.orders) && tb.orders.length > 0;
            const seats = Number(tb?.seats) || Number(tb?.capacity) || 4;
            const tableShapeUri = seats >= 6 ? '/assets/image/6table.svg' : seats >= 5 ? '/assets/image/5table.svg' : '/assets/image/4table.svg';
            const isSelected = selectedTableId != null && String(selectedTableId) === id;
            const tableBgClass = hasOpenOrders ? 'bg-rose-500' : 'bg-green-500';
            return (
              <Pressable
                key={id}
                className={`mb-4 w-[31.5%] min-h-[120px] items-center justify-center rounded-lg overflow-hidden ${isSelected ? 'border-white border-2' : 'border-none'} ${tableBgClass}`}
                onPress={() =>
                  handleSelectAndClose(tb, {
                    tableLabel: tableNumber,
                    roomName: currentRoom?.name ?? null
                  })
                }
              >
                <ExpoImage source={{ uri: tableShapeUri }} style={{ width: 96, height: 96 }} contentFit="contain" />
                <Text className="absolute text-white text-xl font-bold">{tableNumber}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View className="flex-row flex-wrap justify-around py-3 px-2 bg-pos-panel gap-2">
        <Pressable
          className="py-2 px-3 active:bg-green-500 rounded"
          onPress={() => setSelectedRoomIndex((p) => (sortedRooms.length ? (p + 1) % sortedRooms.length : 0))}
        >
          <Text className="text-pos-text">{t('nextCourse')}</Text>
        </Pressable>
        <Pressable className="py-2 px-3 active:bg-green-500 rounded" onPress={() => setShowRoomsModal(true)}>
          <Text className="text-pos-text">{currentRoom?.name ?? t('room1')}</Text>
        </Pressable>
        <Pressable className="py-2 px-3 active:bg-green-500 rounded" onPress={() => handleSelectAndClose(null)}>
          <Text className="text-pos-text">{t('noTable')}</Text>
        </Pressable>
      </View>

      <Modal visible={showRoomsModal} transparent animationType="fade">
        <Pressable className="flex-1 bg-black/60 justify-center p-4" onPress={() => setShowRoomsModal(false)}>
          <View className="bg-pos-bg rounded-xl border border-pos-border p-6 max-h-[80%]">
            <Text className="text-pos-text text-2xl font-semibold mb-4">{t('room1')}</Text>
            <ScrollView>
              {sortedRooms.map((room, idx) => (
                <Pressable
                  key={room?.id ?? idx}
                  className={`py-3 px-4 rounded-lg mb-2 ${selectedRoomIndex === idx ? 'bg-pos-rowHover border-2 border-pos-border' : 'bg-pos-panel'}`}
                  onPress={() => {
                    setSelectedRoomIndex(idx);
                    setShowRoomsModal(false);
                  }}
                >
                  <Text className="text-pos-text">
                    {room?.name ?? `${t('handheldRoomPrefix')} ${idx + 1}`}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable className="mt-4 py-2 bg-pos-panel rounded border border-pos-border" onPress={() => setShowRoomsModal(false)}>
              <Text className="text-center text-pos-text">{t('backName')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
