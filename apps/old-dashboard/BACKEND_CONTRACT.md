# Nexo AI - Backend Contract Requirements

This document outlines the API endpoints and data structures required by the Dashboard.

## 1. Authentication (Better Auth)

The dashboard expects `better-auth` integration.

- **Base URL**: `/api/auth`
- **Expected Session Object**:
  ```json
  {
  	"user": {
  		"id": "string",
  		"name": "string",
  		"email": "string",
  		"role": "admin | user",
  		"image": "string (url)"
  	}
  }
  ```

## 2. Analytics

- **Endpoint**: `GET /api/analytics`
- **Permissions**: `role: admin`
- **Returns**: `AnalyticsData`
  ```json
  {
    "kpis": [
      { "title": "Total Users", "value": "1.2k", "trend": 10.5, "icon": "Users" }
    ],
    "trends": {
      "labels": ["Jan", "Feb", ...],
      "datasets": [{ "label": "Growth", "data": [10, 20, ...], "color": "#hex" }]
    },
    "breakdown": {
      "labels": ["Links", "Media", ...],
      "data": [40, 60]
    }
  }
  ```

## 3. Memories

- **Endpoint**: `GET /api/memories`
- **Params**: `?category=...&search=...&limit=...`
- **Returns**: `MemoryItem[]`
- **Actions**:
  - `POST /api/memories` (Create)
  - `PATCH /api/memories/:id` (Update)
  - `DELETE /api/memories/:id` (Delete)

## 4. Admin Management

- **Error Reports**: `GET /api/admin/errors`
  - Returns: `ErrorReport[]`
- **Anonymous Conversations**: `GET /api/admin/conversations`
  - Returns: `ConversationSummary[]`
  - _Note_: Ensure `userHash` is anonymized.

## 5. User Profile

- **Endpoint**: `GET /api/user/profile`
- **Sync Accounts**: `POST /api/user/link-account`
- **Preferences**: `GET /api/user/preferences` | `PATCH /api/user/preferences`
