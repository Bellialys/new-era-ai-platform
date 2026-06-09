# 32 - Model Catalog Governance Addendum

## MVP status

`32-model-catalog-governance.md` describes the target governance standard for a mature model catalog.

The current MVP database schema is smaller and uses:

- `model_key`;
- `provider`;
- `display_name`;
- `description`;
- `price_label`;
- `is_active`;
- `is_public`;
- `role_tags`;
- `context_length`;
- `max_output_tokens`;
- `raw_metadata`.

## Rule

Do not add all governance fields to the database at once.

First keep Stable Prompt Arena working. Then extend `models` through a separate migration.

## Future migration fields

Possible future fields:

- `access_level`;
- `status`;
- `supports_text`;
- `supports_code`;
- `supports_image_input`;
- `fallback_available`;
- `quality_notes`.
