module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['./jest.setup.js'],
  // ESM のまま配布されているライブラリも Babel で変換する
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|@notifee|react-native-.*)/)',
  ],
};
