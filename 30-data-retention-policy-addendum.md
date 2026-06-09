# 30 - Data Retention Policy Addendum

This file extends `30-data-retention-policy.md` until the placeholder can be replaced.

## Retention rules

Anonymous sessions should be stored for a limited period, normally 30-90 days.

Account history can be stored while the account exists.

Error responses can be stored for diagnostics, but not forever.

Logs must not contain secrets.

Users should later have a way to delete their account and related data.

## Forbidden log data

- API keys;
- service role keys;
- authorization headers;
- production environment values;
- full private secrets.

## MVP status

Automatic deletion jobs are not part of the first Prompt Arena MVP. They should be added after stable persistence and account settings are ready.
