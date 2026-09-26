---
lat:
  require-code-mention: true
---

# Request logging

リクエストログの相関情報と秘匿値の扱いを、HonoXルートを通すテストで守る。

## Query redaction and request correlation

構造化ログにはrequest ID・HTTP method・queryを除いたpath・最終statusを含め、query内の同期キーを含めない。これにより障害調査と秘密値の保護を両立する。

## Redirect status

末尾スラッシュのリダイレクトも、構造化ログのstatusとHTTP応答のstatusが一致することを維持する。設計は[[architecture#Request pipeline]]を参照する。
