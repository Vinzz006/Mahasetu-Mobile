import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { Header } from '../../../components/common/Header';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { EmptyState } from '../../../components/common/EmptyState';
import { Colors, Spacing, Typography, BorderRadius } from '../../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../store/AuthContext';
import { notificationService } from '../../../services/notificationService';
import { NotificationItem } from '../../../types';

export default function CitizenNotificationsScreen() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const unsub = notificationService.subscribeToNotifications(
      user,
      (list) => {
        setNotifications(list);
        setLoading(false);
      },
      (err) => {
        setError(err || 'Failed to load notifications');
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    setError(null);
    setTimeout(() => setRefreshing(false), 800);
  };

  const markRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    notificationService.markAsRead(id);
  };

  const renderItem = ({ item }: { item: NotificationItem }) => {
    const isSms = item.channel === 'SMS';

    return (
      <TouchableOpacity
        style={[styles.notifCard, !item.read && styles.unreadCard]}
        onPress={() => markRead(item.id)}
      >
        <View style={styles.iconRow}>
          <View style={[styles.iconCircle, isSms && styles.smsIconCircle]}>
            <Ionicons
              name={isSms ? 'chatbox-ellipses' : 'notifications'}
              size={18}
              color={isSms ? Colors.accent : Colors.primary}
            />
          </View>
          <View style={styles.titleArea}>
            <Text style={styles.titleText}>{item.title}</Text>
            <View style={styles.channelBadge}>
              <Text style={styles.channelText}>
                {isSms ? 'Twilio SMS Notification' : 'In-App Alert'}
              </Text>
            </View>
          </View>
          {!item.read && <View style={styles.unreadDot} />}
        </View>

        <Text style={styles.messageText}>{item.message}</Text>

        <View style={styles.footerRow}>
          {item.applicationNumber && (
            <Text style={styles.appRef}>Ref: {item.applicationNumber}</Text>
          )}
          <Text style={styles.timeText}>
            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="Notifications & Alerts"
        subtitle="In-app and Twilio SMS notification log"
      />

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={
            error ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={20} color={Colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="notifications-off-outline"
              title="No Notifications"
              description="You have no alerts at this time."
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  notifCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  unreadCard: {
    borderColor: '#93C5FD',
    backgroundColor: '#F0F7FF',
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  smsIconCircle: {
    backgroundColor: Colors.accentLight,
  },
  titleArea: {
    flex: 1,
  },
  titleText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  channelBadge: {
    marginTop: 2,
  },
  channelText: {
    fontSize: Typography.fontSize.xs - 2,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryLight,
  },
  messageText: {
    fontSize: Typography.fontSize.xs + 1,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginVertical: Spacing.xs,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.xs,
    marginTop: Spacing.xs,
  },
  appRef: {
    fontSize: Typography.fontSize.xs - 2,
    fontWeight: '700',
    color: Colors.primary,
  },
  timeText: {
    fontSize: Typography.fontSize.xs - 2,
    color: Colors.textMuted,
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    color: Colors.danger,
    fontWeight: '500',
  },
});
