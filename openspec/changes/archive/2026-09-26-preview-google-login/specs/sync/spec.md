## ADDED Requirements

### Requirement: プレビューセッションのユーザー識別子

プレビュー環境で確立したセッションのユーザー識別子は、本番で同じ Google アカウントに割り当てる `providerAccountId` と一致しなければならない (MUST)。

#### Scenario: プレビューログイン後の識別子

- **WHEN** 許可されたアカウントがプレビューでログインを完了したとき
- **THEN** セッションのユーザー識別子は、その Google アカウントの `providerAccountId` であり、本番のセッションと同じ値である
