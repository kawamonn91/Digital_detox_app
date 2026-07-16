/**
 * DebtRingChart.tsx
 * 負債の返済進捗を円形プログレスバー風（View）で表示
 * ← react-native-svg 不使用（互換性の問題を回避）
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { COLORS, FONTS } from '../theme';

interface Props {
  percent: number;   // 0.0 ~ 1.0
  screens: number;
  meters: number;
}

const SIZE = 130;
const THICKNESS = 12;

export default function DebtRingChart({ percent, screens, meters }: Props) {
  const animVal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animVal, {
      toValue: Math.min(1, percent),
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [percent]);

  const isComplete = percent >= 1;
  const ringColor  = isComplete ? COLORS.green400 : COLORS.purple400;

  // 0〜360度を rotation で表現（半円を2つ使う古典的手法）
  const deg = animVal.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const halfAngle = animVal.interpolate({
    inputRange:  [0, 0.5, 1],
    outputRange: ['0deg', '180deg', '180deg'],
  });
  const showSecondHalf = percent > 0.5;

  return (
    <View style={styles.wrapper}>
      {/* リング本体 */}
      <View style={styles.ring}>
        {/* 背景リング */}
        <View style={[styles.ringBg]} />

        {/* 前半（0〜180度） */}
        <View style={[styles.half, styles.leftHalf]}>
          <Animated.View
            style={[
              styles.halfInner,
              styles.leftInner,
              { borderColor: ringColor, transform: [{ rotate: halfAngle }] },
            ]}
          />
        </View>

        {/* 後半（180〜360度）*/}
        {showSecondHalf && (
          <View style={[styles.half, styles.rightHalf]}>
            <Animated.View
              style={[
                styles.halfInner,
                styles.rightInner,
                {
                  borderColor: ringColor,
                  transform: [{ rotate: deg }],
                },
              ]}
            />
          </View>
        )}

        {/* 中央テキスト */}
        <View style={styles.center}>
          <Text style={[styles.percentText, isComplete && styles.greenText]}>
            {Math.round(percent * 100)}%
          </Text>
          <Text style={styles.subText}>返済済</Text>
        </View>
      </View>

      <Text style={styles.label}>{screens.toFixed(0)} 画面スクロール</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    width: SIZE,
  },
  ring: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringBg: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: THICKNESS,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  half: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    overflow: 'hidden',
  },
  leftHalf: {
    // 左半分だけ表示
  },
  rightHalf: {
    // 右半分だけ表示
    transform: [{ scaleX: -1 }],
  },
  halfInner: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: THICKNESS,
    borderColor: COLORS.purple400,
  },
  leftInner: {
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    transform: [{ rotate: '0deg' }],
  },
  rightInner: {
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  center: {
    alignItems: 'center',
  },
  percentText: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.purple400,
    fontFamily: FONTS.grotesk,
  },
  greenText: { color: COLORS.green400 },
  subText: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: -2,
  },
  label: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },
});
