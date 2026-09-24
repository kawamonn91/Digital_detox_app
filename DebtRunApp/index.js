/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { registerRunForegroundService } from './src/services/runForeground';

// ランニング計測中の前面サービス(アプリ起動前に登録しておく必要がある)
registerRunForegroundService();

AppRegistry.registerComponent(appName, () => App);
