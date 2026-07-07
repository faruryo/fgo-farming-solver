# Design: progress-consumption-neutral-reduced-ap

## Context

`reducedAp` は「目標を現在で固定し、所持だけ過去→現在へ動かした残りAP減少」（方式1）:

```
reducedAp = solve(現在目標 − 過去所持) − solve(現在目標 − 現在所持)
```

現在目標（`material/result`）は `sumMaterials(chaldeaState)` の**残量**であり、育成すると目標側も縮む。このため育成で消費した素材は「所持減」としてだけ残り、消費素材を他サーヴァント（または all テンプレート）がまだ必要としている場合、reducedAp を目減りさせる。数値例（1日経過、自然回復 288AP、1個=20AP のクエスト）:

| シナリオ | reducedAp | tier |
|---|---|---|
| 素材20個獲得のみ | 400 | medium |
| 同じ獲得20個 + 育成で10個消費 | 200 | small |
| 獲得20個 + 消費30個 | −200 | スループット補完 |

「消費が獲得を上回る日」は補完（`reducedAp <= 0` → throughput 判定）で救済済みだが、「正だが目減り」するケースが穴。育成の活動量はスループット指標（`itemsFarmed + itemsConsumed`）で既に加点対象であり、reducedAp 側で二重にペナルティを課すのは設計意図（目標増加の影響を含めない）と非対称。

算出箇所は2つ:
- `lib/progress/compute-reduction.ts` の `computeReduction`（テスト済みの純関数）
- `hooks/use-progress-report.ts:100-111` の enriched useMemo（`solveTotals` + `buildNeedByApiItemId` を直呼びするインライン重複）

## Goals / Non-Goals

**Goals:**
- 育成消費を reducedAp/reducedLap に対して中立にする（周回獲得のみを測る）
- 「目標を増やしても reducedAp は増加しない」既存不変条件の維持
- 算出ロジックの一本化（hooks のインライン重複を共通関数へ）

**Non-Goals:**
- tier 閾値（自然回復比 1.0x/1.5x、スループット 10/50 個/日）の見直し
- スナップショット形式・サーバAPI（`/api/progress`）の変更
- gross（同一素材の獲得と消費の両建て）の復元 — 2スナップショット間では net しか観測できない既知の制約のまま

## Decisions

### D1: 消費中立化は「現在所持の過去所持クランプ」で行う

```
adjustedNow[i] = max(現在所持[i], 過去所持[i])
reducedAp = solve(目標 − 過去所持) − solve(目標 − adjustedNow)
```

- アイテムごとに純消費（過去所持 > 現在所持）分を足し戻すのと等価。純増した素材はそのまま獲得として効く。
- アイテムごとに `adjustedNow >= 過去所持` なので need は単調減少し、**reducedAp / reducedLap は常に非負**になる（ソルバーの線形性により総量も非負）。
- 代替案A「目標側に消費分を足す（過去時点の目標を復元）」: 数学的には同じ狙いだが、消費が育成計算機の目標に対応している保証がなく（計算機外の育成・所持手修正）、目標をいじる方が不変条件（目標固定）の説明を壊す。所持側クランプの方が実装・仕様とも単純。
- 代替案B「tier 判定時だけ補正し表示は従来値」: 表示の「目標への前進」も同じ歪み（育成した日だけ前進が小さく見える）を持つため、指標そのものを直す。

### D2: 実装は `computeReduction` 内に閉じ、hooks は共通関数を呼ぶ

- `compute-reduction.ts` にクランプを実装（エクスポートは `computeReduction` の挙動変更として。必要なら `clampPosessionToPast` を内部ヘルパで）。
- `use-progress-report.ts` のインライン再ソルブ（`solveTotals` 2連発）を `computeReduction` 呼び出しに置換し、重複と将来の乖離を除去。挙動差分は消費中立化のみ。

### D3: `finalize-baseline.ts` はロジック不変

- `noReduced = reducedAp == null || reducedAp <= 0` はそのまま。クランプ後は負値が来ないため、実質「null（drops 未ロード）または 0（獲得ゼロ）」で発動する。負値ハンドリングを残すのは防御として無害。
- コメントの「育成で素材消費が上回った日」の記述を実態（獲得ゼロの日）に合わせて更新。

### D4: 死にコード `sumNewServantOffsetAp` を削除

- 旧設計（rarity 別 AP オフセットで新規鯖の目標増を補正）の残骸で参照ゼロ。`detectNewServants` / `NewServantEntry` は summary.ts が使用中のため維持。`rarity-ap-table` 系の依存が offset 専用なら合わせて整理（tier.test.ts の該当テストも削除）。

## Risks / Trade-offs

- [所持の手修正（入力ミス訂正で所持を下げた）も「消費」として足し戻される] → 従来は逆に進捗マイナスとして扱われており、中立化の方が誤差として穏当。net ベースの既知の制約に含める。
- [同一素材を「獲得20・消費30」した期間、獲得20が reducedAp に乗らない] → gross 復元不能（既知の制約）。スループット指標では 50 個分の活動として加点されるため、体感との乖離は限定的。
- [reducedAp が常に非負になることで、表示側の負値ガード（`reducedLap <= 0` 非表示等）の前提が変わる] → ガードは残す（0 のときは従来どおり非表示）。

## Migration Plan

クライアント算出のみの変更でデータ移行なし。デプロイ後、次回ダッシュボード表示から新しい値になる。ロールバックはコード revert のみ。
