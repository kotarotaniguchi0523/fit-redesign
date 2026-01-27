# Plan: Timer関連コードの改善

## 概要
useTimerのAudioContextメモリリーク修正と、QuestionTimerの展開パネルに外側クリック検知・Escキー対応を追加する。

## 背景・課題

### 高優先度の問題
1. **AudioContextメモリリーク** (useTimer.ts:67)
   - カウントダウン完了時に毎回新しいAudioContextを生成
   - ブラウザのAudioContext上限（約6個）に達するとエラー発生リスク

2. **展開パネルのUX問題** (QuestionTimer.tsx:169-189)
   - 外側クリックでパネルが閉じない（トグルボタンでのみ閉じる）
   - Escキーで閉じる動作がない

### 低優先度の問題（今回は対応保留）
- useTimerの責務混在: 現状154行で十分管理可能
- QuestionTimerの責務過多: 現状284行で過度な分割は複雑化を招く
- フォーカストラップ: 設定パネルは複雑なフォーム操作がなく必須ではない

## 実装ステップ

### Step 1: AudioContext シングルトン化

**目的**: AudioContextの再利用でメモリリークを防止

**変更内容**:
```typescript
// useTimer.ts - AudioContextをモジュールレベルで管理
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext || audioContext.state === "closed") {
    audioContext = new AudioContext();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
  return audioContext;
}
```

**注意点**:
- `audioContext.state === "closed"`のチェックで再作成を許可
- ブラウザのautoplay policyに対応するため`resume()`を呼び出す

### Step 2: 外側クリック検知とEscキー対応の追加

**目的**: 展開パネルのUX改善（既存UI・アニメーション維持）

**変更内容**:
```tsx
// QuestionTimer.tsx
const panelRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const handleClickOutside = (e: MouseEvent) => {
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
      setIsExpanded(false);
    }
  };
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === "Escape") setIsExpanded(false);
  };

  if (isExpanded) {
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
  }
  return () => {
    document.removeEventListener("mousedown", handleClickOutside);
    document.removeEventListener("keydown", handleEscape);
  };
}, [isExpanded]);

// motion.divにrefを追加
<motion.div ref={panelRef} ...>
```

**得られる改善**:
- 外側クリックで自動的に閉じる
- Escキーで閉じる
- 既存のframer-motionアニメーションを維持
- 既存のUIスタイルを維持

## 作成・変更するファイル

| ファイル | 操作 | 説明 |
|---------|------|------|
| src/hooks/useTimer.ts | 変更 | AudioContextシングルトン化 |
| src/components/QuestionTimer.tsx | 変更 | 外側クリック検知・Escキー対応追加 |

## 検証方法

### AudioContext修正の検証
1. カウントダウンモードで複数回タイマー完了させる（10回以上）
2. ブラウザの開発者ツール > Console でAudioContext関連エラーが出ないことを確認
3. アラート音が正常に鳴ることを確認

### 外側クリック・Escキー対応の検証
1. 設定ボタンをクリックしてパネルが表示されることを確認
2. **パネル外側をクリックして閉じることを確認**
3. **Escキーで閉じることを確認**
4. パネル内のボタン操作が正常に動作することを確認
5. アニメーションが既存と同じことを確認
6. `pnpm typecheck` でエラーなし
7. `pnpm build` が成功すること

## リスク・注意点

1. **AudioContext resume()の必要性**: ユーザーインタラクション前にAudioContextを使用しようとするとsuspended状態になる。resume()を適切なタイミングで呼び出す必要がある。

2. **イベントリスナーのクリーンアップ**: useEffectのクリーンアップ関数で確実にリスナーを削除する。

3. **ref設定位置**: motion.divにrefを設定することで、パネル内クリックが外側クリックと判定されないようにする。

## 対応を見送った項目

| 項目 | 理由 |
|------|------|
| HeroUI Popoverへの移行 | 既存UI・アニメーション維持のため、最小限の変更で対応 |
| useTimerからアラート音再生を分離 | 現状154行で責務が明確 |
| QuestionTimerのコンポーネント分割 | 現状284行で可読性に問題なし |
| フォーカストラップ | 設定パネルは複雑なフォーム操作がなく必須ではない |
