# Referência Técnica

## Database Schema

### `users`

```typescript
{
  id: uuid,
  phone_number: string,
  whatsapp_name: string,
  created_at: timestamp
}
```

### `items`

```typescript
{
  id: uuid,
  user_id: uuid,
  type: 'movie' | 'video' | 'link' | 'note',
  title: string,
  metadata: jsonb,  // Estrutura varia por tipo
  created_at: timestamp
}
```

**Metadata por tipo:**

**Movie:**

```typescript
{
  tmdb_id: number,
  year: number,
  genres: string[],
  rating: number,
  streaming: [{ provider: string, url: string }],
  poster_url: string
}
```

**Video:**

```typescript
{
  video_id: string,
  platform: 'youtube' | 'vimeo',
  channel_name: string,
  duration: number,
  views: number
}
```

**Link:**

```typescript
{
  url: string,
  og_title: string,
  og_description: string,
  og_image: string
}
```

**Note:**

```typescript
{
  category: string,
  related_topics: string[],
  priority: 'low' | 'medium' | 'high'
}
```

### `conversations`

```typescript
{
  id: uuid,
  user_id: uuid,
  state: 'idle' | 'awaiting_confirmation' | 'enriching' | 'saving' | 'error',
  context: jsonb,
  updated_at: timestamp
}
```

### `messages`

```typescript
{
  id: uuid,
  conversation_id: uuid,
  role: 'user' | 'assistant',
  content: string,
  created_at: timestamp
}
```

## API Endpoints

### POST `/webhook/meta`

Webhook Meta WhatsApp

**Headers:**

```
X-Hub-Signature-256: sha256=...
```

**Body:**

```json
{
  "entry": [
    {
      "changes": [
        {
          "value": {
            "messages": [
              {
                "from": "5511999999999",
                "text": { "body": "clube da luta" }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

### GET `/items`

Lista items do usuário

**Query:**

- `type`: movie | video | link | note
- `limit`: número de resultados (default: 20)

**Response:**

```json
{
  "items": [
    {
      "id": "uuid",
      "type": "movie",
      "title": "Fight Club",
      "metadata": { ... }
    }
  ]
}
```

### POST `/items/search`

Busca semântica

**Body:**

```json
{
  "query": "filmes de ficção científica",
  "limit": 10
}
```

### GET `/health`

Health check

**Response:**

```json
{
  "status": "ok"
}
```
