import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HUD } from '@/components/HUD';
import { PagerIndicator } from '@/components/PagerIndicator';
import { useT } from '@/i18n';
import { ArenaScreen } from '@/screens/ArenaScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { MatcherScreen } from '@/screens/MatcherScreen';
import { colors } from '@/theme';

/** Gesture-first shell: HUD on top, three swipeable pages, translucent indicator at the bottom. */
export default function Main() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const pagerRef = useRef<PagerView>(null);
  const progress = useSharedValue(0);
  const [homeLocked, setHomeLocked] = useState(false);
  const [battleActive, setBattleActive] = useState(false);
  const locked = homeLocked || battleActive;

  const onHomeLockChange = useCallback((locked: boolean) => setHomeLocked(locked), []);
  const onBattleChange = useCallback((playing: boolean) => setBattleActive(playing), []);

  return (
    <View style={styles.root}>
      <HUD />
      <PagerView
        ref={pagerRef}
        style={styles.flex}
        initialPage={0}
        scrollEnabled={!locked}
        overdrag
        onPageScroll={(e) => {
          progress.value = e.nativeEvent.position + e.nativeEvent.offset;
        }}
      >
        <View key="home" style={styles.flex}>
          <HomeScreen onSwipeLockChange={onHomeLockChange} />
        </View>
        <View key="matcher" style={styles.flex}>
          <MatcherScreen />
        </View>
        <View key="arena" style={styles.flex}>
          <ArenaScreen onBattleChange={onBattleChange} />
        </View>
      </PagerView>
      {locked ? (
        <View style={{ height: insets.bottom }} />
      ) : (
        <PagerIndicator
          progress={progress}
          labels={[t('pageHome'), t('pageMatcher'), t('pageArena')]}
          onSelect={(i) => pagerRef.current?.setPage(i)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
});
