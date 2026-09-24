/* eslint-env jest */
// ネイティブモジュールを使うライブラリのモック(Jest は実機の Android 実装を持たないため)

jest.mock('@notifee/react-native', () => require('@notifee/react-native/jest-mock'));

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async key => (store.has(key) ? store.get(key) : null)),
      setItem: jest.fn(async (key, value) => { store.set(key, value); }),
      removeItem: jest.fn(async key => { store.delete(key); }),
    },
  };
});

jest.mock('react-native-sqlite-storage', () => ({
  __esModule: true,
  default: {
    enablePromise: jest.fn(),
    openDatabase: jest.fn(async () => ({
      executeSql: jest.fn(async () => [{ rows: { length: 0, item: () => undefined } }]),
    })),
  },
}));

jest.mock('react-native-geolocation-service', () => ({
  __esModule: true,
  default: { watchPosition: jest.fn(() => 1), clearWatch: jest.fn() },
}));

jest.mock('react-native-linear-gradient', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: View };
});

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
