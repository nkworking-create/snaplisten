# SnapListen

撮った英文を、聴いて繰り返す。
写真／スクショ → AIが文字起こし → 自然な音声で読み上げ → セッション保存 → 何度でも再生（オフライン）。

```
snaplisten/
  backend/   中継サーバー（APIキーを安全に保持。/ocr と /tts の2本）
  app/       Expo アプリ（ライブラリ / 撮る→確認 / プレイヤー の3画面）
```

---

## 1. APIキーを用意する

- **ElevenLabs**：https://elevenlabs.io でアカウント作成 → API キーを取得
- **Gemini**：tango-app の古いキーは流出状態なので **作り直して** 新しいキーを使う

## 2. バックエンドを起動

```sh
cd backend
copy .env.example .env        # .env を作る（.env は git に乗らない）
# .env を開いて GEMINI_API_KEY と ELEVENLABS_API_KEY を貼る
npm install                   # 初回のみ
npm start                     # http://localhost:8787 で起動
```

## 3. アプリを起動

```sh
cd app
npm install                   # 初回のみ
npm start                     # Expo が QR コードを表示
```

スマホに **Expo Go** を入れて QR を読む（PCとスマホは同じ Wi-Fi）。
アプリは Expo の開発サーバーと同じ PC の IP を見て、自動でバックエンド
(`http://<PCのIP>:8787`) に繋ぎにいく（`app/src/config.js`）。

## 4. 使い方

1. 「＋ 新規」→ カメラで撮る / 写真から選ぶ
2. 読み取られた英文を確認・微修正 → 「保存して聴く」
3. プレイヤーで再生 / リピート / 速度（0.75・1.0・1.25×）
4. 音声は端末にキャッシュ。以降の再生は無料＆オフライン

## 後で：本番デプロイ

backend を Render 等にデプロイしたら、`app/src/config.js` の
`MANUAL_RELAY_URL` にその https URL を入れる。キーは Render の
環境変数に設定（コードや git には絶対に入れない）。
