import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { registerAlertHost } from '../utils/customAlert';
import { fonts } from '../styles/theme';
import { fontSize, wp } from '../utils/responsive';

const alertStyles = {
  success: {
    label: 'Success',
    icon: 'check',
    color: '#07856F',
    background: '#E8F7F2',
  },
  error: {
    label: 'Something went wrong',
    icon: 'close',
    color: '#D14343',
    background: '#FFF0F0',
  },
  warning: {
    label: 'Please review',
    icon: 'priority-high',
    color: '#B7791F',
    background: '#FFF7E6',
  },
  info: {
    label: 'Information',
    icon: 'info',
    color: '#005086',
    background: '#EAF4FB',
  },
  confirm: {
    label: 'Confirmation',
    icon: 'help-outline',
    color: '#005086',
    background: '#EAF4FB',
  },
};

const getAlertStyle = (title, buttons) => {
  const normalizedTitle = String(title || '').toLowerCase();
  const hasDestructiveAction = buttons.some((button) => button?.style === 'destructive');

  if (/success|saved|done|complete|created|updated|submitted|logged in|sent|added|approved/.test(normalizedTitle)) {
    return alertStyles.success;
  }
  if (/validation|invalid|missing info|not allowed|notice|warning|select child|no video/.test(normalizedTitle)) {
    return alertStyles.warning;
  }
  if (/error|failed|failure|unable|could not/.test(normalizedTitle)) {
    return alertStyles.error;
  }
  if (hasDestructiveAction) {
    return alertStyles.warning;
  }
  if (buttons.length > 1) {
    return alertStyles.confirm;
  }
  return alertStyles.info;
};

export default function AlertHost() {
  const [queue, setQueue] = useState([]);
  const animation = useRef(new Animated.Value(0)).current;
  const iconAnimation = useRef(new Animated.Value(0)).current;
  const isClosing = useRef(false);
  const useNativeDriver = Platform.OS !== 'web';

  useEffect(
    () => registerAlertHost((config) => setQueue((items) => [...items, config])),
    [],
  );

  const current = queue[0];
  const buttons = current?.buttons?.length
    ? current.buttons
    : [{ text: 'OK' }];
  const presentation = getAlertStyle(current?.title, buttons);
  const title = current?.title ? String(current.title) : '';
  const message = current?.message ? String(current.message) : '';

  useEffect(() => {
    if (!current) return undefined;

    isClosing.current = false;
    animation.setValue(0);
    iconAnimation.setValue(0);
    Animated.parallel([
      Animated.timing(animation, {
        toValue: 1,
        duration: 190,
        easing: Easing.out(Easing.cubic),
        useNativeDriver,
      }),
      Animated.spring(iconAnimation, {
        toValue: 1,
        speed: 18,
        bounciness: 8,
        useNativeDriver,
      }),
    ]).start();

    return undefined;
  }, [animation, current, iconAnimation, useNativeDriver]);

  const dismiss = (button) => {
    if (isClosing.current || !current) return;
    isClosing.current = true;

    Animated.timing(animation, {
      toValue: 0,
      duration: 140,
      easing: Easing.in(Easing.cubic),
      useNativeDriver,
    }).start(({ finished }) => {
      if (!finished) return;

      setQueue((items) => items.slice(1));
      try {
        button?.onPress?.();
      } finally {
        current.options?.onDismiss?.();
      }
    });
  };

  const onRequestClose = () => {
    if (current?.options?.cancelable === false) return;
    dismiss(buttons.find((button) => button?.style === 'cancel'));
  };

  const cardScale = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1],
  });
  const cardTranslateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 0],
  });
  const iconScale = iconAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.65, 1],
  });

  return (
    <Modal
      visible={Boolean(current)}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onRequestClose}
    >
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: animation,
          },
        ]}
      >
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.card,
            {
              borderTopColor: presentation.color,
              opacity: animation,
              transform: [
                { scale: cardScale },
                { translateY: cardTranslateY },
              ],
            },
          ]}
        >
          <Animated.View
            style={[
              styles.iconBadge,
              {
                backgroundColor: presentation.background,
                transform: [{ scale: iconScale }],
              },
            ]}
          >
            <MaterialIcons
              name={presentation.icon}
              size={fontSize(34)}
              color={presentation.color}
            />
          </Animated.View>

          <Text
            accessibilityLiveRegion="assertive"
            style={[styles.eyebrow, { color: presentation.color }]}
          >
            {presentation.label}
          </Text>

          <ScrollView
            style={styles.copy}
            contentContainerStyle={styles.copyContent}
            showsVerticalScrollIndicator={false}
          >
            {!!title && <Text style={styles.title}>{title}</Text>}
            {!!message && <Text style={styles.message}>{message}</Text>}
          </ScrollView>

          <View style={[styles.buttons, buttons.length === 2 && styles.buttonRow]}>
            {buttons.map((button, index) => {
              const isCancel = button?.style === 'cancel';
              const isDestructive = button?.style === 'destructive';
              const buttonColor = isCancel ? '#F1F5F9'
                : isDestructive ? '#D14343'
                  : presentation.color;
              const textColor = isCancel ? '#475569' : '#FFFFFF';

              return (
                <TouchableOpacity
                  key={`${button?.text || 'OK'}-${index}`}
                  accessibilityRole="button"
                  activeOpacity={0.82}
                  onPress={() => dismiss(button)}
                  style={[
                    styles.button,
                    {
                      backgroundColor: buttonColor,
                      borderColor: isCancel ? '#E2E8F0' : buttonColor,
                    },
                    buttons.length === 2 && styles.buttonInRow,
                  ]}
                >
                  <Text style={[styles.buttonText, { color: textColor }]}>
                    {button?.text || 'OK'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: wp(22),
    paddingVertical: wp(24),
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '86%',
    backgroundColor: '#FFFFFF',
    borderRadius: wp(24),
    borderTopWidth: 4,
    paddingHorizontal: wp(24),
    paddingTop: wp(24),
    paddingBottom: wp(20),
    alignItems: 'center',
    elevation: 18,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.2,
    shadowRadius: 28,
  },
  iconBadge: {
    width: wp(72),
    height: wp(72),
    borderRadius: wp(36),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: wp(14),
  },
  eyebrow: {
    fontSize: fontSize(11),
    fontFamily: fonts.semiBold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: wp(6),
  },
  copy: {
    width: '100%',
    flexShrink: 1,
  },
  copyContent: {
    alignItems: 'center',
    paddingBottom: wp(4),
  },
  title: {
    width: '100%',
    color: '#172B3A',
    fontSize: fontSize(19),
    fontFamily: fonts.bold,
    lineHeight: fontSize(27),
    textAlign: 'center',
  },
  message: {
    width: '100%',
    color: '#5B6873',
    fontSize: fontSize(14),
    fontFamily: fonts.regular,
    lineHeight: fontSize(22),
    textAlign: 'center',
    marginTop: wp(8),
  },
  buttons: {
    width: '100%',
    gap: wp(10),
    marginTop: wp(22),
  },
  buttonRow: {
    flexDirection: 'row',
  },
  button: {
    minHeight: wp(48),
    borderWidth: 1,
    borderRadius: wp(14),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: wp(14),
    paddingVertical: wp(10),
  },
  buttonInRow: {
    flex: 1,
  },
  buttonText: {
    fontSize: fontSize(14),
    fontFamily: fonts.semiBold,
    lineHeight: fontSize(20),
    textAlign: 'center',
  },
});
