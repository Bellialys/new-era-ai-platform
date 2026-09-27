# ADR-004: Envelope Encryption and Crypto-Shredding Boundary

**Status:** Accepted with clarification  
**Original date:** 2026-07  
**Clarified:** 2026-09-27  
**Deciders:** Platform Team

---

## Context

Проекту нужны две разные гарантии, которые раньше были смешаны в одном решении:

1. **Encryption at rest для чувствительных application secrets** — например persistent OpenRouter BYOK и platform-managed provider credentials.
2. **Crypto-shredding для данных, которые могут существовать в immutable/retained backups** — то есть возможность сделать исторические ciphertext необратимо недоступными уничтожением отдельного key material.

Эти гарантии не эквивалентны.

Предыдущая формулировка ADR предполагала, что обычная envelope encryption автоматически даёт crypto-shredding после удаления live DEK. Для AWS KMS это технически неверно, если encrypted DEK хранится рядом с ciphertext и попадает в backup, а shared KMS KEK продолжает существовать.

AWS KMS `GenerateDataKey` возвращает plaintext DEK для кратковременного использования и encrypted copy этого DEK. AWS KMS не хранит этот DEK как отдельный deletable per-user object. Поэтому удаление только live DB row не уничтожает wrapped DEK, который уже оказался в immutable backup.

---

## Decision A — Stage 3 credential encryption

Для Stage 3 provider credentials использовать envelope encryption:

```text
Vercel Function
  -> short-lived Vercel OIDC
  -> AWS IAM role
  -> AWS KMS symmetric KEK
  -> GenerateDataKey(AES_256)
  -> local AES-256-GCM encryption of provider credential
  -> Supabase stores ciphertext + encrypted DEK + non-secret KMS metadata
```

### KMS provider

**AWS KMS** выбран как основной target для Stage 3 credential encryption.

Причины:

- нативный `GenerateDataKey` соответствует envelope-encryption pattern;
- plaintext root KMS key не экспортируется;
- Vercel поддерживает short-lived OIDC federation в AWS без long-lived AWS access keys;
- IAM policy можно ограничить конкретным KMS key ARN и минимальными actions;
- архитектура не требует передавать provider credential самому KMS.

### Encryption rules

- один случайный DEK на credential/connection;
- data cipher: AES-256-GCM;
- plaintext DEK существует только в process memory на время encrypt/decrypt;
- после использования plaintext DEK должен быть очищен/освобождён настолько быстро, насколько позволяет runtime;
- в Supabase хранятся только provider ciphertext и encrypted DEK;
- KMS encryption context использует только non-secret opaque metadata, например `credential_id`, `provider`, `origin`;
- email, prompt, API key, user display name и другие PII не помещаются в encryption context, потому что context может появляться в audit/CloudTrail;
- KMS IAM role должен разрешать только необходимые операции на конкретном key ARN, без broad `Resource: "*"` для cryptographic operations;
- Vercel -> AWS auth использует OIDC/workload identity, а не static AWS access key.

Это решение обеспечивает strong encryption at rest и отделяет compromise базы данных от возможности расшифровать provider secrets.

---

## Decision B — что считается настоящим crypto-shredding

Следующий pattern **не считается** достаточным crypto-shredding для immutable backups:

```text
shared KMS KEK
+ encrypted DEK stored in Supabase
+ Supabase backup contains encrypted DEK
+ live row deletion
```

Если shared KMS KEK всё ещё доступен, encrypted DEK из исторического backup потенциально можно расшифровать.

Для настоящего crypto-shredding нужен отдельный deletable key boundary, который **не восстанавливается вместе с data backup**, например:

- subject-specific/per-connection key material в отдельном deletion-capable key registry вне immutable application backups;
- либо отдельный per-subject KEK/HSM object, если cardinality/cost позволяют;
- либо другой отдельный design, где уничтожение key material делает все исторические copies ciphertext необратимо недоступными.

Такой storage/key-registry design требует отдельного ADR до того, как проект будет заявлять мгновенное crypto-shredding данных из immutable backups.

---

## Current deletion semantics for Stage 3 credentials

До реализации отдельного backup crypto-shredding layer:

### Platform-managed OpenRouter credential

1. remote key disable/revoke/delete;
2. удалить live credential ciphertext + wrapped DEK;
3. сохранить только минимальный non-secret reconciliation/audit metadata;
4. backup copies считаются retained encrypted historical data;
5. restore procedure обязана повторно применять erasure/revocation tombstones и не должна автоматически реактивировать provider credentials.

Remote revoke является критической защитой: восстановленный из backup старый platform key не должен снова стать рабочим credential.

### User-provided OpenRouter BYOK

New Era не может revoke внешний ключ пользователя.

При disconnect/account deletion:

1. удалить live ciphertext + wrapped DEK;
2. прекратить любое использование credential;
3. сохранить только safe non-secret audit metadata;
4. backup retention и restore-reconciliation должны исключать возврат удалённого credential в active state.

Пока отдельный crypto-shredding key registry не реализован, документация не должна утверждать, что BYOK ciphertext исчезает из immutable backups мгновенно или становится криптографически необратимым сразу после live deletion.

---

## Consequences

### Positive

- Stage 3 получает практичную и масштабируемую KMS encryption boundary.
- Vercel не хранит long-lived AWS access keys.
- Database dump сам по себе недостаточен для расшифровки provider credentials.
- Исправляется ложная гарантия «shared KMS + wrapped DEK в backup = crypto-shredding».
- Future compliance architecture получает чёткую отдельную задачу вместо скрытого assumption.

### Negative

- AWS KMS становится новой infrastructure dependency.
- Stage 3.2 потребует AWS KMS resource + IAM role + Vercel OIDC configuration.
- Реальный backup crypto-shredding остаётся отдельной будущей задачей.
- Добавление AWS/Vercel OIDC runtime SDK packages требует отдельного dependency review по project quality rules.

---

## Verification requirements

Перед Stage 3 credential persistence:

- KMS key существует и имеет symmetric `ENCRYPT_DECRYPT` usage;
- Vercel OIDC role может только `kms:GenerateDataKey`, `kms:Decrypt` и минимально необходимый `kms:DescribeKey` на конкретном key ARN;
- static AWS access keys отсутствуют;
- encrypt/decrypt round-trip test проходит;
- wrong encryption context fails closed;
- corrupted ciphertext fails closed;
- secret не появляется в logs/API/audit;
- database-only dump не позволяет расшифровать credential;
- backup restore test не реактивирует revoked/deleted credentials.

---

## Related decisions

- `49-openrouter-funding-byok-plan.md`
- ADR-001 HMAC-SHA256 for safe fingerprints
- ADR-002 double-entry billing ledger
- ADR-003 reconciliation is alert-only
- `16-decisions.md` DEC-018/DEC-019

---

## External technical references reviewed

- AWS KMS `GenerateDataKey`
- AWS KMS envelope encryption guidance
- AWS KMS IAM least-privilege guidance
- Vercel OIDC federation documentation
