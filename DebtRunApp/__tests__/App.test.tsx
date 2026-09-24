/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

// アニメーション(負債リングなど)がテスト終了後も動き続けないよう、タイマーを止めておく
jest.useFakeTimers();

test('アプリ全体を描画でき、ホームにスクロール負債が表示される', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });
  const texts = renderer!.root.findAll(node => (node.type as unknown) === 'Text').map(node => node.props.children);
  expect(texts).toContain('スクロール負債');
  await ReactTestRenderer.act(async () => {
    renderer!.unmount();
  });
});
