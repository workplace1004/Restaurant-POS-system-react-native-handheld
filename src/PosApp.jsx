import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, Image } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { io } from 'socket.io-client';
import { useLanguage } from './contexts/LanguageContext';
import { useApi } from './contexts/ApiContext';
import { usePos } from './hooks/usePos';
import { OrderPanel } from './components/OrderPanel';
import { TablesView } from './components/TablesView';
import { LoginScreen } from './components/LoginScreen';
import { LoadingSpinner } from './components/LoadingSpinner';
import {
  WebordersModalRN,
  InPlanningModalRN,
  InWaitingModalRN,
  CustomersModalRN
} from './components/OrderModals';

const API = '/api';
const USER_STORAGE_KEY = 'pos-user';
const VIEW_STORAGE_KEY = 'pos-view';
const VALID_VIEWS = ['pos', 'tables'];

const mobileLayout = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#2c3e50' },
  header: {
    paddingVertical: 16,
    paddingHorizontal: 14,
    minHeight: 78,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#34495e',
    backgroundColor: '#1f2b38',
    flexDirection: 'row',
    alignItems: 'center',
  },
  body: { flex: 1, minHeight: 0 },
  footer: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#34495e',
    backgroundColor: '#1f2b38',
  },
});

function loadStoredUser() {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    const u = JSON.parse(raw);
    return u && u.id && (u.label ?? u.name) ? u : null;
  } catch {
    return null;
  }
}

function loadStoredView() {
  try {
    const v = localStorage.getItem(VIEW_STORAGE_KEY);
    return VALID_VIEWS.includes(v) ? v : 'pos';
  } catch {
    return 'pos';
  }
}

/** HH:mm in 24h — device local time. Hermes on Android rejects some IANA zones (e.g. Europe/Kyiv). */
function formatPosClock(date = new Date()) {
  try {
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    const h = date.getHours();
    const m = date.getMinutes();
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}

export default function PosApp() {
  const { t, lang, setLang } = useLanguage();
  const { socketOrigin, apiBase } = useApi();
  const [user, setUser] = useState(loadStoredUser);
  const [view, setView] = useState(loadStoredView);
  const [selectedTable, setSelectedTable] = useState(null);
  const [selectedTableLabel, setSelectedTableLabel] = useState(null);
  const [selectedRoomName, setSelectedRoomName] = useState(null);
  const [roomCount, setRoomCount] = useState(null);
  const [isOpeningTables, setIsOpeningTables] = useState(false);

  const socket = useMemo(() => {
    if (!socketOrigin) return null;
    try {
      return io(socketOrigin, { path: '/socket.io', transports: ['websocket', 'polling'] });
    } catch {
      return null;
    }
  }, [socketOrigin]);

  useEffect(() => {
    return () => {
      socket?.disconnect?.();
    };
  }, [socket]);

  const [time, setTime] = useState(() => formatPosClock());
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [ordersModalTab, setOrdersModalTab] = useState('new');
  const [showInPlanningModal, setShowInPlanningModal] = useState(false);
  const [showInWaitingModal, setShowInWaitingModal] = useState(false);
  const [focusedOrderId, setFocusedOrderId] = useState(null);
  const [focusedOrderInitialItemCount, setFocusedOrderInitialItemCount] = useState(0);
  const [showCustomersModal, setShowCustomersModal] = useState(false);
  const [showSubtotalView, setShowSubtotalView] = useState(false);
  const [subtotalBreaks, setSubtotalBreaks] = useState([]);
  const [quantityInput, setQuantityInput] = useState('');
  const [showInWaitingButton, setShowInWaitingButton] = useState(false);
  const [mobileTab, setMobileTab] = useState('menu');
  const [processingSubTab, setProcessingSubTab] = useState('in_waiting');
  const [selectedProcessingOrderId, setSelectedProcessingOrderId] = useState(null);
  const [menuStep, setMenuStep] = useState('categories');
  const [menuCategoryId, setMenuCategoryId] = useState(null);
  const [menuSubproductModalOpen, setMenuSubproductModalOpen] = useState(false);
  const [menuSelectedProduct, setMenuSelectedProduct] = useState(null);
  const [menuSelectedOrderItemId, setMenuSelectedOrderItemId] = useState(null);
  const [menuSubproducts, setMenuSubproducts] = useState([]);
  const [selectedMenuSubproductIds, setSelectedMenuSubproductIds] = useState(() => new Set());
  const [pendingLang, setPendingLang] = useState(lang);

  useEffect(() => {
    if (mobileTab === 'settings') setPendingLang(lang);
  }, [mobileTab, lang]);

  const setViewAndPersist = useCallback((nextView) => {
    setView(nextView);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, nextView);
    } catch {
      /* ignore */
    }
  }, []);

  const {
    categories,
    products,
    selectedCategoryId,
    setSelectedCategoryId,
    currentOrder,
    orders,
    fetchInWaitingCount,
    tables,
    addItemToOrder,
    removeOrderItem,
    updateOrderItemQuantity,
    setOrderStatus,
    createOrder,
    markOrderPrinted,
    removeOrder,
    removeAllOrders,
    fetchCategories,
    fetchProducts,
    fetchOrders,
    fetchWebordersCount,
    fetchInPlanningCount,
    fetchTables,
    historyOrders,
    fetchOrderHistory,
    fetchSubproductsForProduct,
    savedPositioningLayoutByCategory,
    fetchSavedPositioningLayout,
    savedPositioningColorByCategory,
    fetchSavedPositioningColors,
    savedFunctionButtonsLayout,
    fetchSavedFunctionButtonsLayout,
    tableLayouts,
    fetchTableLayouts,
    appendSubproductNoteToItem,
    setOrderTable
  } = usePos(API, socket, selectedTable?.id ?? null, focusedOrderId);

  const fetchRoomCount = useCallback(async () => {
    try {
      const res = await fetch(`${API}/rooms`);
      const data = await res.json().catch(() => []);
      setRoomCount(Array.isArray(data) ? data.length : 0);
    } catch {
      setRoomCount(null);
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTime(formatPosClock()), 1000);
    return () => clearInterval(id);
  }, []);

  const refreshDeviceSettings = useCallback(() => {
    try {
      const raw = localStorage.getItem('pos_device_settings');
      const saved = raw ? JSON.parse(raw) : {};
      const allFour =
        !!saved.ordersConfirmOnHold &&
        !!saved.ordersCustomerCanBeModified &&
        !!saved.ordersBookTableToWaiting &&
        !!saved.ordersFastCustomerName;
      setShowInWaitingButton(!!allFour);
    } catch {
      setShowInWaitingButton(false);
    }
  }, []);

  useEffect(() => {
    refreshDeviceSettings();
    (async () => {
      try {
        const res = await fetch(`${API}/settings/device-settings`);
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          const saved = data?.value;
          if (saved && typeof saved === 'object' && Object.keys(saved).length > 0) {
            localStorage.setItem('pos_device_settings', JSON.stringify(saved));
            refreshDeviceSettings();
          }
        }
      } catch {
        /* ignore */
      }
    })();
  }, [refreshDeviceSettings]);

  useEffect(() => {
    fetchCategories();
    fetchOrders();
    fetchWebordersCount();
    fetchInPlanningCount();
    fetchInWaitingCount();
    fetchTables();
    fetchSavedPositioningLayout();
    fetchSavedPositioningColors();
    fetchSavedFunctionButtonsLayout();
    fetchRoomCount();
  }, [
    fetchCategories,
    fetchOrders,
    fetchWebordersCount,
    fetchInPlanningCount,
    fetchInWaitingCount,
    fetchTables,
    fetchSavedPositioningLayout,
    fetchSavedPositioningColors,
    fetchSavedFunctionButtonsLayout,
    fetchRoomCount
  ]);

  useEffect(() => {
    if (selectedCategoryId) fetchProducts(selectedCategoryId);
  }, [selectedCategoryId, fetchProducts]);

  useEffect(() => {
    if (!menuCategoryId && Array.isArray(categories) && categories.length > 0) {
      setMenuCategoryId(categories[0].id);
    }
  }, [categories, menuCategoryId]);

  useEffect(() => {
    if (menuCategoryId) fetchProducts(menuCategoryId);
  }, [menuCategoryId, fetchProducts]);

  useEffect(() => {
    if (view === 'pos') {
      fetchSavedPositioningLayout();
      fetchSavedPositioningColors();
      fetchSavedFunctionButtonsLayout();
      fetchRoomCount();
      refreshDeviceSettings();
    }
  }, [view, fetchSavedPositioningLayout, fetchSavedPositioningColors, fetchSavedFunctionButtonsLayout, fetchRoomCount, refreshDeviceSettings]);

  useEffect(() => {
    setSubtotalBreaks([]);
  }, [currentOrder?.id]);

  const itemCount = currentOrder?.items?.length ?? 0;
  const lastBreak = subtotalBreaks[subtotalBreaks.length - 1] ?? 0;
  const hasNewItemsSinceLastSubtotal = itemCount > lastBreak;
  const subtotalButtonDisabled = itemCount === 0 || !hasNewItemsSinceLastSubtotal;

  const handleSubtotalClick = () => {
    if (subtotalButtonDisabled) return;
    const n = currentOrder?.items?.length ?? 0;
    setSubtotalBreaks((prev) => [...prev, n]);
    setShowSubtotalView(true);
  };

  const handleLogin = (loggedInUser) => {
    setUser(loggedInUser);
    setViewAndPersist('pos');
    try {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(loggedInUser));
    } catch {
      /* ignore */
    }
  };

  const handleLogout = () => {
    setUser(null);
    try {
      localStorage.removeItem(USER_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  const handleSelectTable = useCallback(
    async (table, options) => {
      const orderWithItemsNoTable = currentOrder?.items?.length > 0 && !currentOrder?.tableId;
      if (table != null && orderWithItemsNoTable && currentOrder?.id) {
        await setOrderTable(currentOrder.id, table.id);
      }
      setFocusedOrderId(null);
      setFocusedOrderInitialItemCount(0);
      setSelectedTable(table);
      if (table == null) {
        setSelectedTableLabel(null);
        setSelectedRoomName(null);
      } else {
        setSelectedTableLabel(options?.tableLabel ?? null);
        setSelectedRoomName(options?.roomName ?? (table?.name ?? null));
      }
      setViewAndPersist('pos');
    },
    [setViewAndPersist, currentOrder, setOrderTable]
  );

  const handleAddProductWithSelectedTable = useCallback(
    async (product) => {
      const qty = Math.max(1, parseInt(quantityInput, 10) || 1);
      setQuantityInput('');
      return addItemToOrder(product, qty, selectedTable?.id || null);
    },
    [addItemToOrder, selectedTable?.id, quantityInput]
  );

  const handleOpenTables = useCallback(async () => {
    setViewAndPersist('tables');
    setIsOpeningTables(true);
    try {
      await Promise.all([fetchTables(), fetchTableLayouts(), fetchRoomCount()]);
    } finally {
      setIsOpeningTables(false);
    }
  }, [setViewAndPersist, fetchTables, fetchTableLayouts, fetchRoomCount]);

  const openCategoryProducts = useCallback((categoryId) => {
    setMenuCategoryId(categoryId);
    setSelectedCategoryId(categoryId);
    setMenuStep('products');
  }, [setSelectedCategoryId]);

  const closeMenuSubproducts = useCallback(() => {
    setMenuSubproductModalOpen(false);
    setMenuSelectedProduct(null);
    setMenuSelectedOrderItemId(null);
    setMenuSubproducts([]);
    setSelectedMenuSubproductIds(new Set());
  }, []);

  const handleMenuProductPress = useCallback(async (product) => {
    const createdOrderItemId = await handleAddProductWithSelectedTable(product);
    const subs = await fetchSubproductsForProduct(product.id);
    if (Array.isArray(subs) && subs.length > 0) {
      setMenuSelectedProduct(product);
      setMenuSelectedOrderItemId(createdOrderItemId || null);
      setMenuSubproducts(subs);
      setSelectedMenuSubproductIds(new Set());
      setMenuSubproductModalOpen(true);
    }
  }, [fetchSubproductsForProduct, handleAddProductWithSelectedTable]);

  const handleMenuSubproductPress = useCallback(async (subproduct) => {
    if (!menuSelectedOrderItemId) return;
    const note = subproduct?.name || '';
    if (!note) return;
    const wasAdded = await appendSubproductNoteToItem(
      menuSelectedOrderItemId,
      note,
      Number(subproduct?.price) || 0
    );
    setSelectedMenuSubproductIds((prev) => {
      const next = new Set(prev);
      if (wasAdded) next.add(subproduct.id);
      else next.delete(subproduct.id);
      return next;
    });
  }, [appendSubproductNoteToItem, menuSelectedOrderItemId]);

  const menuSubproductsByGroup = useMemo(() => {
    if (!menuSubproducts.length) return [];
    const byGroup = new Map();
    for (const sp of menuSubproducts) {
      const gid = sp?.groupId || sp?.group?.id || '';
      const gname = sp?.group?.name || '';
      if (!byGroup.has(gid)) {
        byGroup.set(gid, { groupName: gname, sortOrder: sp?.group?.sortOrder ?? 0, items: [] });
      }
      byGroup.get(gid).items.push(sp);
    }
    return Array.from(byGroup.entries())
      .sort(
        (a, b) =>
          (a[1].sortOrder ?? 0) - (b[1].sortOrder ?? 0) ||
          (a[1].groupName || '').localeCompare(b[1].groupName || '')
      )
      .map(([gid, data]) => ({ groupId: gid, groupName: data.groupName, items: data.items }));
  }, [menuSubproducts]);

  const inWaitingOrders = (orders || []).filter((o) => o?.status === 'in_waiting');
  const inPlanningOrders = (orders || []).filter((o) => o?.status === 'in_planning');
  const activeProcessingOrders = processingSubTab === 'in_planning' ? inPlanningOrders : inWaitingOrders;
  const completedOrders = historyOrders || [];

  const footerButtons = [
    { id: 'table', label: t('control.functionButton.tables'), icon: 'table-furniture' },
    { id: 'menu', label: t('handheldMenuTab'), icon: 'silverware-fork-knife' },
    { id: 'orders', label: t('orders'), icon: 'clipboard-text-outline' },
    { id: 'processing', label: t('processing'), icon: 'progress-clock' },
    { id: 'complete', label: t('complete'), icon: 'check-decagram-outline' },
  ];
  const viewingProcessingHoldOrder =
    !!focusedOrderId &&
    currentOrder?.id === focusedOrderId &&
    (currentOrder?.status === 'in_waiting' || currentOrder?.status === 'in_planning');
  const currentTableName = viewingProcessingHoldOrder
    ? null
    : selectedTableLabel ||
      selectedTable?.name ||
      selectedTable?.label ||
      currentOrder?.table?.name ||
      currentOrder?.tableName ||
      (currentOrder?.tableId ? `#${currentOrder.tableId}` : null);
  const headerMeta = [time, user?.label].filter(Boolean).join(' - ');

  const resolveProductImageUri = useCallback((rawPath) => {
    const raw = String(rawPath || '').trim();
    if (!raw) return '';
    if (/^data:image\//i.test(raw)) return raw;
    if (/^https?:\/\//i.test(raw)) return raw;
    if (/^file:\/\//i.test(raw)) return raw;
    const path = raw.replace(/\\/g, '/');
    if (path.startsWith('//')) return `http:${path}`;
    const origin = socketOrigin || (apiBase ? apiBase.replace(/\/?api\/?$/, '') : '');
    if (!origin) return path;
    if (path.startsWith('/')) return `${origin}${path}`;
    return `${origin}/${path}`;
  }, [apiBase, socketOrigin]);

  if (!user) {
    return <LoginScreen time={time} onLogin={handleLogin} />;
  }

  return (
    <View style={mobileLayout.root}>
      <View style={mobileLayout.header}>
        <View className="flex-1">
          <Text className="text-pos-text text-lg font-semibold">{t('handheldAppTitle')}</Text>
          <Text className="text-pos-muted text-xs mt-0.5">
            {`${headerMeta}`}
          </Text>
        </View>
        <Pressable
          className="h-12 w-12 items-center justify-center rounded-full bg-pos-panel active:bg-green-500"
          onPress={() => setMobileTab('settings')}
        >
          <MaterialCommunityIcons name="cog-outline" size={24} color="#ecf0f1" />
        </Pressable>
      </View>

      <View style={mobileLayout.body}>
        {mobileTab === 'table' ? (
          isOpeningTables ? (
            <LoadingSpinner label={t('loadingTables')} />
          ) : (
            <TablesView
              tables={tables}
              tableLayouts={tableLayouts}
              fetchTableLayouts={fetchTableLayouts}
              selectedTableId={selectedTable?.id ?? null}
              onSelectTable={handleSelectTable}
              onBack={() => setMobileTab('menu')}
              time={time}
              api={API}
            />
          )
        ) : null}

        {mobileTab === 'menu' ? (
          <View className="flex-1 p-3">
            {menuStep === 'categories' ? (
              <ScrollView contentContainerStyle={{ paddingBottom: 12 }}>
                <View className="flex-row flex-wrap justify-between">
                  {(categories || []).map((category) => (
                    <Pressable
                      key={`cat-${category.id}`}
                      className="mb-3 min-h-[76px] w-[48%] items-center justify-center rounded-lg bg-pos-panel px-2 active:bg-green-500"
                      onPress={() => openCategoryProducts(category.id)}
                    >
                      <Text className="text-pos-text text-center font-medium">{category.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            ) : (
              <View className="flex-1">
                <View className="mb-3 flex-row items-center justify-between">
                  <Pressable
                    className="rounded-md bg-pos-panel px-3 py-2 active:bg-green-500"
                    onPress={() => setMenuStep('categories')}
                  >
                    <Text className="text-pos-text">{t('back')}</Text>
                  </Pressable>
                  <Text className="text-pos-text text-sm font-medium">
                    {(categories || []).find((c) => c.id === menuCategoryId)?.name || ''}
                  </Text>
                </View>
                <ScrollView contentContainerStyle={{ paddingBottom: 12 }}>
                  <View className="flex-row flex-wrap justify-between">
                    {(products || []).map((product) => (
                      <Pressable
                        key={`product-${product.id}`}
                        className="mb-3 min-h-[130px] w-[48%] rounded-lg bg-pos-panel p-2 active:bg-green-500"
                        onPress={() => handleMenuProductPress(product)}
                      >
                        {(() => {
                          const uri = resolveProductImageUri(product?.kassaPhotoPath);
                          // if (!uri) return <View className="h-[72px] w-[55%] rounded-md bg-pos-bg" />;
                          if (/^data:image\//i.test(uri)) {
                            return <Image source={{ uri }} style={{ width: '65%', minHeight: 130, maxHeight: 130, borderRadius: 8 }} resizeMode="cover" />;
                          }
                          return (
                            <ExpoImage
                              source={{ uri }}
                              style={{ width: '65%', minHeight: 130, maxHeight: 130, borderRadius: 8 }}
                              contentFit="cover"
                            />
                          );
                        })()}
                        <Text className="mt-2 text-pos-text font-semibold max-w-[70%]" numberOfLines={2}>{product.name}</Text>
                        <Text className="absolute right-2 top-2 text-pos-muted">€ {Number(product.price || 0).toFixed(2)}</Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}
          </View>
        ) : null}

        {mobileTab === 'orders' ? (
          <OrderPanel
            order={currentOrder}
            orders={orders}
            focusedOrderId={focusedOrderId}
            focusedOrderInitialItemCount={focusedOrderInitialItemCount}
            onRemoveItem={removeOrderItem}
            onUpdateItemQuantity={updateOrderItemQuantity}
            onStatusChange={setOrderStatus}
            onCreateOrder={async (tableId) => {
              setFocusedOrderId(null);
              setFocusedOrderInitialItemCount(0);
              await createOrder(tableId);
            }}
            onRemoveAllOrders={async () => {
              await removeAllOrders();
              setFocusedOrderId(null);
              setFocusedOrderInitialItemCount(0);
            }}
            showInPlanningButton={Array.isArray(savedFunctionButtonsLayout) && savedFunctionButtonsLayout.includes('geplande-orders')}
            onSaveInWaitingAndReset={async () => {
              setFocusedOrderId(null);
              setFocusedOrderInitialItemCount(0);
              await createOrder(null);
              fetchOrders();
            }}
            tables={tables}
            showSubtotalView={showSubtotalView}
            subtotalBreaks={subtotalBreaks}
            onPaymentCompleted={() => {
              fetchOrderHistory();
              fetchTables();
            }}
            selectedTable={selectedTable}
            currentUser={user}
            currentTime={time}
            tableDisplayName={currentTableName || t('noTable')}
            onOpenTables={handleOpenTables}
            quantityInput={quantityInput}
            setQuantityInput={setQuantityInput}
            showInWaitingButton={showInWaitingButton}
            onOpenInPlanning={() => {
              setShowInPlanningModal(true);
              fetchOrders();
            }}
            onGoToInPlanningProcessing={async () => {
              setFocusedOrderId(null);
              setFocusedOrderInitialItemCount(0);
              await createOrder(null);
              setProcessingSubTab('in_planning');
              setMobileTab('processing');
              fetchOrders();
            }}
            onOpenInWaiting={() => {
              setShowInWaitingModal(true);
              fetchOrders();
            }}
          />
        ) : null}

        {mobileTab === 'processing' ? (
          <ScrollView className="flex-1 p-3">
            <View className="mt-3 flex-row gap-2">
              <Pressable
                className={`flex-1 rounded-md p-3 active:bg-green-500 ${processingSubTab === 'in_waiting' ? 'bg-green-600' : 'bg-pos-panel'}`}
                onPress={() => {
                  setProcessingSubTab('in_waiting');
                  fetchOrders();
                }}
              >
                <Text className="text-pos-text text-center">{t('control.functionButton.inWaiting')}</Text>
              </Pressable>
              <Pressable
                className={`flex-1 rounded-md p-3 active:bg-green-500 ${processingSubTab === 'in_planning' ? 'bg-green-600' : 'bg-pos-panel'}`}
                onPress={() => {
                  setProcessingSubTab('in_planning');
                  fetchOrders();
                }}
              >
                <Text className="text-pos-text text-center">{t('inPlanning')}</Text>
              </Pressable>
            </View>
            <ScrollView className="mt-3">
              {activeProcessingOrders.map((order) => (
                <Pressable
                  key={`proc-${processingSubTab}-${order.id}`}
                  className={`mb-2 rounded-md p-3 ${
                    (processingSubTab === 'in_waiting' || processingSubTab === 'in_planning') && selectedProcessingOrderId === order.id
                      ? 'bg-green-500'
                      : 'bg-pos-panel'
                  }`}
                  onPress={() => {
                    if (processingSubTab === 'in_waiting' || processingSubTab === 'in_planning') {
                      setSelectedProcessingOrderId((prev) => (prev === order.id ? null : order.id));
                    }
                  }}
                >
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1">
                      <Text className="text-pos-text font-semibold">#{order.id}</Text>
                      <Text
                        className={`text-xs mt-1 ${
                          (processingSubTab === 'in_waiting' || processingSubTab === 'in_planning') && selectedProcessingOrderId === order.id
                            ? 'text-white'
                            : 'text-pos-muted'
                        }`}
                      >
                        {order.status}
                      </Text>
                    </View>
                    {(processingSubTab === 'in_waiting' || processingSubTab === 'in_planning') && selectedProcessingOrderId === order.id ? (
                      <Pressable
                        className="ml-2 mt-1 h-8 w-8 items-center justify-center rounded-full bg-pos-panel/30"
                        onPress={() => {
                          // These orders are not table orders; clear any stale table selection so Orders shows No Table (not "Add to table").
                          setSelectedTable(null);
                          setSelectedTableLabel(null);
                          setSelectedRoomName(null);
                          setFocusedOrderId(order.id);
                          setFocusedOrderInitialItemCount(order?.items?.length ?? 0);
                          setMobileTab('orders');
                        }}
                        accessibilityLabel="Open selected waiting order"
                      >
                        <MaterialCommunityIcons name="check" size={20} color="#ffffff" />
                      </Pressable>
                    ) : null}
                  </View>
                </Pressable>
              ))}
              {activeProcessingOrders.length === 0 ? (
                <View className="rounded-md bg-pos-panel p-3 min-h-[74vh] max-h-[74vh] items-center justify-center">
                  <MaterialCommunityIcons name="clipboard-text-off-outline" size={72} color="#95a5a6" />
                  <Text className="text-pos-muted text-center text-xl mt-4">{t('handheldNoOrdersFound')}</Text>
                </View>
              ) : null}
            </ScrollView>
          </ScrollView>
        ) : null}

        {mobileTab === 'complete' ? (
          <ScrollView className="flex-1 p-3">
            {completedOrders.map((order) => (
              <View key={`complete-${order.id}`} className="mb-2 rounded-md bg-pos-panel p-3">
                <View className="flex-row items-center justify-between">
                  <Text className="text-pos-text font-semibold">#{order.id}</Text>
                  <Text className="text-pos-text text-sm mt-2 text-right">
                    {t('handheldPaid')}: € {Number(order?.total || 0).toFixed(2)}
                  </Text>
                </View>
                <View className="flex-row items-center justify-between">
                  <Text className="text-pos-muted text-xs mt-1">
                    {order?.createdAt ? new Date(order.createdAt).toLocaleString() : ''}
                  </Text>
                  <Text className="text-pos-muted text-xs mt-1">
                    {(() => {
                      const tableLabel = order?.table?.name || order?.tableName || order?.table?.label || (order?.tableId ? `#${order.tableId}` : null);
                      return tableLabel ? `${t('handheldTablePrefix')}: ${tableLabel}` : t('noTable');
                    })()}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        ) : null}

        {mobileTab === 'settings' ? (
          <View className="flex-1 p-4">
            <Text className="text-pos-text text-xl font-semibold mb-4">{t('settings')}</Text>
            <View className="rounded-lg bg-pos-panel p-4">
              <Text className="text-pos-text text-base font-semibold mb-3">{t('language')}</Text>
              <View className="flex-row flex-wrap gap-2">
                {(['en', 'nl', 'fr', 'tr']).map((id) => (
                  <Pressable
                    key={id}
                    className={`rounded-md px-3 py-2 ${pendingLang === id ? 'bg-green-600' : 'bg-pos-bg active:bg-green-500'}`}
                    onPress={() => setPendingLang(id)}
                  >
                    <Text className="text-pos-text">{t(`control.languageOption.${id}`)}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                className="mt-4 rounded-md bg-green-600 py-3 active:bg-green-500"
                onPress={() => setLang(pendingLang)}
              >
                <Text className="text-center text-white font-semibold">{t('save')}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>

      <View style={mobileLayout.footer}>
        <View className="flex-row items-center justify-between gap-1">
          {footerButtons.map((btn) => (
            <Pressable
              key={btn.id}
              className={`min-w-0 flex-1 min-h-[64px] rounded-md px-1 py-2 items-center justify-center ${mobileTab === btn.id ? 'bg-green-600' : 'bg-pos-panel'}`}
              onPress={async () => {
                setMobileTab(btn.id);
                if (btn.id === 'table') await handleOpenTables();
                if (btn.id === 'menu') setMenuStep('categories');
                if (btn.id === 'processing') fetchOrders();
                if (btn.id === 'complete') fetchOrderHistory();
              }}
            >
              <MaterialCommunityIcons name={btn.icon} size={22} color="#ecf0f1" />
              <Text className="mt-1 text-pos-text text-xs font-medium" numberOfLines={1}>{btn.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Modal visible={menuSubproductModalOpen} transparent animationType="fade" onRequestClose={closeMenuSubproducts}>
        <View className="flex-1">
          {/* Backdrop only — tapping dimmed area closes; not a parent of the sheet (avoids accidental close on panel taps). */}
          <Pressable className="absolute inset-0 bg-black/40" onPress={closeMenuSubproducts} />
          <View className="absolute inset-0 justify-end" pointerEvents="box-none">
            <View className="max-h-[70%] w-full rounded-t-xl border border-pos-border bg-pos-panel p-4">
              <Text className="mb-3 text-pos-text text-base font-semibold">
                {menuSelectedProduct?.name || ''} — {t('handheldSubproductsSuffix')}
              </Text>
              <ScrollView contentContainerStyle={{ paddingBottom: 10 }}>
                {menuSubproductsByGroup.map(({ groupId, groupName, items }) => (
                  <View key={groupId === '' ? 'ungrouped' : String(groupId)} className="mb-4">
                    <Text className="mb-2 text-pos-muted text-sm font-semibold">
                      {groupName || t('control.productSubproducts.withoutGroup')}
                    </Text>
                    <View className="flex-row flex-wrap justify-between">
                      {items.map((sub) => (
                        <Pressable
                          key={`menu-sub-${sub.id}`}
                          className={`mb-2 min-h-[56px] w-[48%] justify-center rounded-md px-2 ${
                            selectedMenuSubproductIds.has(sub.id) ? 'bg-green-600' : 'bg-pos-bg'
                          }`}
                          onPress={() => handleMenuSubproductPress(sub)}
                        >
                          <Text className="text-pos-text text-center">{sub.name}</Text>
                          <Text className="text-white text-center text-xs mt-1">€ {Number(sub.price || 0).toFixed(2)}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ))}
              </ScrollView>
              <Pressable className="mt-2 rounded-md bg-green-600 py-2" onPress={closeMenuSubproducts}>
                <Text className="text-center text-white font-semibold">{t('ok')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <WebordersModalRN
        open={showOrdersModal}
        onClose={() => setShowOrdersModal(false)}
        weborders={(orders || []).filter((o) => o.status === 'in_planning')}
        inPlanningOrders={historyOrders || []}
        initialTab={ordersModalTab}
        onConfirm={() => {
          fetchOrders();
          fetchOrderHistory();
          fetchWebordersCount();
          fetchInPlanningCount();
        }}
        onCancelOrder={removeOrder}
      />
      <InPlanningModalRN
        open={showInPlanningModal}
        onClose={() => setShowInPlanningModal(false)}
        orders={orders || []}
        onDeleteOrder={async (orderId) => {
          await removeOrder(orderId);
          fetchInPlanningCount();
        }}
        onLoadOrder={(orderId) => {
          setSelectedTable(null);
          setSelectedTableLabel(null);
          const ord = (orders || []).find((o) => o.id === orderId);
          setFocusedOrderId(orderId);
          setFocusedOrderInitialItemCount(ord?.items?.length ?? 0);
          setShowInPlanningModal(false);
        }}
        onFetchOrders={fetchOrders}
      />
      <InWaitingModalRN
        open={showInWaitingModal}
        onClose={() => setShowInWaitingModal(false)}
        orders={orders || []}
        currentUser={user}
        onViewOrder={(orderId) => {
          setSelectedTable(null);
          setSelectedTableLabel(null);
          const viewedOrder = (orders || []).find((o) => o.id === orderId);
          setFocusedOrderId(orderId);
          let savedCount = viewedOrder?.items?.length ?? 0;
          try {
            if (viewedOrder?.itemBatchBoundariesJson) {
              const b = JSON.parse(viewedOrder.itemBatchBoundariesJson);
              if (Array.isArray(b) && b.length > 0) savedCount = b[b.length - 1];
            }
          } catch {
            /* ignore */
          }
          setFocusedOrderInitialItemCount(savedCount);
          setShowInWaitingModal(false);
        }}
        onPrintOrder={async (orderId) => {
          await markOrderPrinted(orderId);
          fetchOrders();
        }}
        onDeleteOrder={async (orderId) => {
          await removeOrder(orderId);
          fetchOrders();
          fetchInPlanningCount();
          fetchInWaitingCount();
        }}
      />
      <CustomersModalRN open={showCustomersModal} onClose={() => setShowCustomersModal(false)} />
    </View>
  );
}
