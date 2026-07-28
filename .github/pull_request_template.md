## Summary

<!-- 何を、なぜ変えたか。 -->

## Review focus

- リスク: <!-- Low / Medium / High -->
- 人間に判断してほしいこと:
  - <!-- UI、操作感、仕様妥当性、データ損失リスクなど。なければ「なし」。 -->
- AIレビューで重点確認すること:
  - <!-- リポジトリ固有の不変条件。lintで分かる事項は書かない。 -->

## Changes

- <!-- 主な変更 -->

## Verification

- [ ] `pnpm run lint`
- [ ] `pnpm run lint:ratchet`
- [ ] `pnpm run type-check`
- [ ] 対象テスト
- [ ] 製品/runtime挙動を変更した場合は該当OpenSpecをvalidateした、または非該当と記載
- [ ] UI変更は実画面またはビジュアル回帰を確認

## AI review resolution

<!-- 指摘がなければ「指摘なし」。指摘ごとに分類・結論・回帰テストを残す。 -->

| Finding                  | Classification                                              | Resolution / reason                     | Regression test                            |
| ------------------------ | ----------------------------------------------------------- | --------------------------------------- | ------------------------------------------ |
| <!-- link or summary --> | <!-- real fix / valid nitpick / false positive or stale --> | <!-- fixed or intentionally skipped --> | <!-- added / existing / not applicable --> |

## Human verification

- [ ] UI・操作感を確認した、または非該当
- [ ] 仕様上の判断点を確認した、または非該当
- [ ] 本番データ・同期・公開データ境界を確認した、または非該当
