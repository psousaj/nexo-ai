# API Surface

> Generated: May 9, 2026 | Branch: development | Commit: 07478fe

## Overview

The API exposes a REST interface via Hono server on port 3001 (dev) or environment-configured port. Endpoints handle user authentication, conversation management, memory operations, and webhook integrations. All endpoints require authentication via Better-Auth sessions (cookies or Bearer tokens) except for webhook routes.

**Base URL:** `http://localhost:3001` (dev) or deployed endpoint

**Response format:** JSON with `Content-Type: application/json`

**Error format:** `{ error: string, code?: string, details?: object }`

## Authentication

All endpoints (except webhooks) require authentication via Better-Auth:

### Session cookie (browser)
```http
GET /memories HTTP/1.1
Cookie: auth_session=eyJ...
```

### Bearer token (API clients)
```http
GET /memories HTTP/1.1
Authorization: Bearer <session_token>
```

Better-Auth handles OAuth (Google, GitHub) and Magic Link flows at `/auth/*` endpoints.

## Endpoints

### Health & Status

#### `GET /health`

Health check endpoint. Used for load balancer probes.

**Response:** 
```json
{ "status": "ok" }
```

**Status codes:** 200 (healthy) | 503 (database error)

---

### Memories

#### `GET /memories`

List or search user's saved memories.

**Query parameters:**
- `search` (optional): Keyword or semantic search query
- `type` (optional): Filter by type (movie, tv, video, note, link)
- `limit` (optional, default: 10): Max results
- `offset` (optional, default: 0): Pagination offset

**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "type": "movie",
      "title": "Inception",
      "description": "...",
      "metadata": { "imdb_id": "tt1375666", "rating": 8.8 },
      "tags": ["sci-fi", "dream"],
      "createdAt": "2024-05-09T12:00:00Z"
    }
  ],
  "total": 42
}
```

**Status codes:** 200 (success) | 400 (bad query) | 401 (unauthorized)

---

#### `POST /memories`

Save a new memory item.

**Request body:**
```json
{
  "type": "movie",
  "title": "Inception",
  "description": "Christopher Nolan sci-fi thriller",
  "metadata": {
    "imdb_id": "tt1375666",
    "rating": 8.8,
    "year": 2010
  },
  "tags": ["sci-fi", "dream", "action"]
}
```

**Response:**
```json
{
  "id": "uuid",
  "type": "movie",
  "title": "Inception",
  "createdAt": "2024-05-09T12:00:00Z"
}
```

**Status codes:** 201 (created) | 400 (validation error) | 401 (unauthorized)

---

#### `DELETE /memories/:id`

Delete a memory item (soft delete).

**Response:** `{ "success": true }`

**Status codes:** 200 (deleted) | 404 (not found) | 401 (unauthorized)

---

### Conversations

#### `GET /conversations`

List user's conversation sessions.

**Query parameters:**
- `limit` (optional, default: 20): Max results
- `offset` (optional, default: 0): Pagination offset

**Response:**
```json
{
  "conversations": [
    {
      "id": "uuid",
      "state": "active",
      "createdAt": "2024-05-09T10:00:00Z",
      "updatedAt": "2024-05-09T12:00:00Z",
      "messageCount": 15
    }
  ],
  "total": 5
}
```

---

#### `GET /conversations/:id`

Get conversation details and history.

**Response:**
```json
{
  "id": "uuid",
  "state": "active",
  "context": {
    "memory_ids": ["uuid1", "uuid2"],
    "last_intent": "search",
    "search_query": "sci-fi movies"
  },
  "messages": [
    {
      "id": "uuid",
      "author": "user",
      "content": "Show me sci-fi movies",
      "role": "user",
      "createdAt": "2024-05-09T10:00:00Z"
    },
    {
      "id": "uuid",
      "author": "bot",
      "content": "Here are some sci-fi movies...",
      "role": "assistant",
      "createdAt": "2024-05-09T10:00:01Z"
    }
  ]
}
```

---

#### `POST /conversations/:id/close`

Close a conversation session.

**Request body:** (optional)
```json
{
  "reason": "completed"
}
```

**Response:** `{ "success": true }`

---

### Accounts

#### `GET /accounts/me`

Get current user profile.

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "channels": [
    {
      "type": "telegram",
      "channelId": "123456789",
      "connectedAt": "2024-05-09T10:00:00Z"
    },
    {
      "type": "whatsapp",
      "channelId": "5511999999999",
      "connectedAt": "2024-05-09T11:00:00Z"
    }
  ]
}
```

---

#### `POST /accounts/connect-channel`

Link a messaging platform to user account.

**Request body:**
```json
{
  "channelType": "telegram",
  "channelId": "123456789",
  "metadata": { "username": "john_doe" }
}
```

**Response:** `{ "success": true }`

---

#### `DELETE /accounts/channels/:channelId`

Disconnect a messaging platform.

**Response:** `{ "success": true }`

---

### Preferences

#### `GET /preferences`

Get user preferences.

**Response:**
```json
{
  "theme": "dark",
  "language": "pt-BR",
  "notifications": {
    "enabled": true,
    "digest": "daily",
    "types": ["memory_saved", "enrichment_available"]
  }
}
```

---

#### `PATCH /preferences`

Update user preferences.

**Request body:**
```json
{
  "theme": "light",
  "notifications": { "enabled": false }
}
```

**Response:** Updated preferences object

---

### WhatsApp Settings

#### `GET /whatsapp-settings`

Get WhatsApp integration settings.

**Response:**
```json
{
  "phoneNumberId": "...",
  "businessAccountId": "...",
  "accessToken": "***" // masked
}
```

---

#### `POST /whatsapp-settings`

Configure WhatsApp integration.

**Request body:**
```json
{
  "phoneNumberId": "...",
  "businessAccountId": "...",
  "accessToken": "..."
}
```

---

### Webhooks (No Auth Required)

#### `POST /webhook/telegram`

Telegram webhook handler. Called by Telegram servers when user sends message.

**Request body:** (Telegram Update object)
```json
{
  "update_id": 123456789,
  "message": {
    "message_id": 1,
    "from": { "id": 123456789, "first_name": "John" },
    "chat": { "id": 123456789, "type": "private" },
    "date": 1620000000,
    "text": "Hello bot"
  }
}
```

**Response:** `{ "ok": true }` or error

**Status codes:** 200 (queued) | 400 (invalid request) | 500 (processing error)

**Note:** Message is queued to Bull; async processing handles any delays.

---

#### `POST /webhook/whatsapp`

WhatsApp webhook handler (via Evolution API or Meta Business API).

**Request body:**
```json
{
  "entry": [
    {
      "id": "...",
      "changes": [
        {
          "field": "messages",
          "value": {
            "messaging_product": "whatsapp",
            "messages": [
              {
                "from": "5511999999999",
                "id": "...",
                "timestamp": "1620000000",
                "type": "text",
                "text": { "body": "Hello" }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

**Response:** `{ "ok": true }`

---

#### `POST /discord/interactions`

Discord interaction handler (slash commands, buttons, etc.).

**Request body:** (Discord Interaction object)
```json
{
  "type": 2,
  "data": {
    "name": "search",
    "options": [
      { "name": "query", "value": "sci-fi movies" }
    ]
  },
  "member": { "user": { "id": "..." } }
}
```

**Response:** Discord Interaction response

---

## Webhook signature verification

All webhooks include request signatures for security:

### Telegram
- Verify hash: `sha256(token + update_json)` matches `X-Telegram-Bot-API-Secret-Token` header

### WhatsApp (Meta)
- Verify: `X-Hub-Signature` header contains `sha256=...` hash

### Discord
- Verify: `X-Signature-Ed25519` and `X-Signature-Timestamp` headers

## Rate limiting

Currently no rate limiting. Consider implementing:

- Per-user: 100 requests/min
- Per-IP: 1000 requests/min
- Webhook: No limit (trusted sources)

## Error responses

### Authentication error (401)
```json
{
  "error": "Unauthorized",
  "code": "UNAUTHORIZED"
}
```

### Validation error (400)
```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "field": "type",
    "message": "must be one of: movie, tv, video, note, link"
  }
}
```

### Not found (404)
```json
{
  "error": "Resource not found",
  "code": "NOT_FOUND"
}
```

### Server error (500)
```json
{
  "error": "Internal server error",
  "code": "INTERNAL_ERROR"
}
```

## Versioning

Currently no API versioning. All endpoints are v0 (unstable). Consider implementing:
- URL versioning: `/v1/memories`
- Header versioning: `Accept: application/vnd.nexo.v1+json`
- Feature flags for gradual rollout

---

**See also:** [ARCHITECTURE.md](./ARCHITECTURE.md), [MODULES.md](./MODULES.md)
