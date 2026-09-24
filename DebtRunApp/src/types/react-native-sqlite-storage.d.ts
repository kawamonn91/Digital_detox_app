// react-native-sqlite-storage には型定義が同梱されていないため、このアプリで使う範囲だけ宣言する
declare module 'react-native-sqlite-storage' {
  export interface ResultSet {
    rows: { length: number; item: (index: number) => any };
  }
  export interface SQLiteDatabase {
    executeSql: (sql: string, params?: unknown[]) => Promise<[ResultSet]>;
  }
  const SQLite: {
    enablePromise: (enabled: boolean) => void;
    openDatabase: (params: { name: string; location: string }) => Promise<SQLiteDatabase>;
  };
  export default SQLite;
}
