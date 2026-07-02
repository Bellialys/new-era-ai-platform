# ADR-006: Cloudflare for SaaS вместо Vercel Domains API для Custom Domains

**Status:** Accepted
**Date:** 2026-07
**Deciders:** Platform Team

---

## Context

Enterprise-клиенты хотят Custom Domains (`ai.acme.com` вместо `app.domain.com`).
При проектировании White-label функциональности (v3.0) рассматривались два варианта:
- Vercel Domains API (встроенный инструмент)
- Cloudflare for SaaS (Cloudflare Custom Hostnames)

---

## Decision

Использовать **Cloudflare for SaaS (Custom Hostnames)** — не Vercel Domains API.

Алгоритм:
1. Org добавляет домен `ai.acme.com`
2. POST к Cloudflare API → создаём Custom Hostname → возвращаем CNAME
3. Cloudflare верифицирует через TXT-запись
4. SSL/TLS сертификат выдаётся автоматически через Cloudflare
5. Трафик с `ai.acme.com` роутится на наши Vercel Functions

---

## Rationale

**Почему не Vercel Domains API:**

**Rate Limits Let's Encrypt:**
- Let's Encrypt: 50 доменов в неделю на один base domain
- При масштабировании (1000+ Enterprise клиентов) — быстро исчерпаем лимит
- Дубликаты ограничены: 5 certificates per week per exact domain
- Нет простого способа увеличить лимит

**Архитектурная связанность:**
- Каждый кастомный домен нужно добавить в Vercel проект вручную (или через API)
- При смене hosting провайдера — нужно переносить все домены
- Не оптимизирован для multi-tenant SaaS с тысячами доменов

**Почему Cloudflare for SaaS:**

**Масштабируемость:**
- Cloudflare управляет собственными лимитами SSL — не зависим от Let's Encrypt rate limits
- Тысячи кастомных доменов без ручной работы

**DDoS защита на уровне Edge:**
- Каждый кастомный домен автоматически получает Cloudflare DDoS protection
- Не нужно настраивать отдельно

**Индустриальный стандарт:**
- Vercel, Netlify, Shopify используют тот же подход для custom domains
- Зрелое API, хорошая документация, SLA

**HSTS enforcement:**
- Cloudflare enforces HSTS для всех кастомных доменов

---

## Consequences

**Позитивные:**
- Нет Rate Limits проблем при масштабировании
- Автоматический SSL + DDoS protection
- Vercel Functions не знают о кастомных доменах — нет архитектурной связанности

**Негативные:**
- Дополнительная зависимость от Cloudflare
- Стоимость: Cloudflare for SaaS тарифицируется по количеству доменов
- Сложнее отладка: трафик проходит через Cloudflare перед Vercel

**Операционные требования:**
- `organization_custom_domains` таблица хранит `cloudflare_hostname_id`
- Вебхук от Cloudflare при изменении статуса → обновляем `status` в БД
- При провале верификации → уведомление admin org
