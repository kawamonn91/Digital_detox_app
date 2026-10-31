import { useAppStore } from '../../src/store/useAppStore';
import { DEFAULT_SETTINGS } from '../../src/services/storageService';

describe('useAppStore', () => {
  beforeEach(() => {
    // ストアの状態をリセット
    useAppStore.setState({
      settings: DEFAULT_SETTINGS,
      isRunning: false,
      summaryVisible: false,
      isLoading: false,
    });
  });

  test('初期状態の検証', () => {
    const state = useAppStore.getState();
    expect(state.isRunning).toBe(false);
    expect(state.summaryVisible).toBe(false);
    expect(state.settings.metersPerScreen).toBe(1.0);
    expect(state.dashboard).toBeDefined();
    expect(state.dashboard.debtMeters).toBe(0);
  });

  test('ランニング状態の切り替え (setIsRunning)', () => {
    const { setIsRunning } = useAppStore.getState();
    setIsRunning(true);
    expect(useAppStore.getState().isRunning).toBe(true);
    setIsRunning(false);
    expect(useAppStore.getState().isRunning).toBe(false);
  });

  test('日別サマリーモーダルの開閉 (openSummary / closeSummary)', () => {
    const { openSummary, closeSummary } = useAppStore.getState();
    expect(useAppStore.getState().summaryVisible).toBe(false);

    openSummary();
    expect(useAppStore.getState().summaryVisible).toBe(true);

    closeSummary();
    expect(useAppStore.getState().summaryVisible).toBe(false);
  });

  test('設定更新とダッシュボード再計算 (setSettings)', async () => {
    const { setSettings } = useAppStore.getState();
    await setSettings({ metersPerScreen: 2.5 });

    const state = useAppStore.getState();
    expect(state.settings.metersPerScreen).toBe(2.5);
    expect(state.dashboard).toBeDefined();
  });
});
