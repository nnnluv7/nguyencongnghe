# Personal cash funds

Every verified, signed-in account can open Tiền quỹ Siêu Thị. Admin, VIP and ordinary members all use their own ledger. Guests still sign in, and deploy previews cannot read or write production funds.

The existing `ncn-cash-fund-v1` store now uses `personal/<SHA-256 of verified Identity ID>`. The server selects that key itself for both reads and atomic receipt writes. Email, name and roles can change without moving a ledger. Request parameters cannot select another account, including for Admin. The receipt owner must match the verified account and the client rejects a response belonging to a changed session. Signing out clears balances, history and open forms.

The old shared `ledger` key is retained untouched. It is not automatically copied into personal accounts because its balance combined transactions from multiple people. New personal ledgers start at zero; the shared archive can be restored separately if the owner requests it. Existing records are not deleted or reassigned.

Validation covers ordinary member access, account isolation including Admin, spoofed owner parameters, concurrent receipts, retries, old archive preservation, account renaming, persistence across reloads, logout and mobile layouts. Currency validation, comma formatting, receipt immutability, no-store caching and same-origin POST checks remain in place.
