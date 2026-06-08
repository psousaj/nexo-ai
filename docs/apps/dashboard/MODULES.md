# Dashboard Modules

> Generated: May 9, 2026 | Branch: development | Commit: 07478fe

## Overview

The Dashboard is organized into pages, components, composables, and stores. Pages are route-specific views that compose components and use composables for data fetching. Stores (Pinia) hold centralized state. Components are reusable UI blocks. This structure follows Vue 3 best practices with emphasis on composition over mixins.

## Page inventory

### pages/index.vue (Dashboard Home)

**Responsibility:** Display system overview with analytics cards and charts.

**Key data:**
- User count, memory count, conversation count
- Recent activities
- Analytics trend charts

**Components used:**
- `AnalyticsCard` — Display metric cards
- `Chart` — TanStack Chart for trends
- `StatsGrid` — Grid layout for stats

**Composables:**
- `useDashboard()` — Fetch analytics data

**Notes:** Landing page after login; re-renders every 5 minutes via query staleTime.

---

### pages/memories.vue (Memory Management)

**Responsibility:** Search, filter, and manage user-saved memories.

**Features:**
- Search by keyword or semantic query
- Filter by type (movie, tv, video, note, link)
- Pagination
- Delete memories (soft delete)
- View memory details

**Components:**
- `SearchBar` — Search input with debounce
- `FilterPanel` — Type/tag filters
- `MemoryTable` — Paginated memory list
- `MemoryModal` — Detail view

**Composables:**
- `useDashboard()` — Memory search + fetch
- `useAbility()` — Check delete permission

**Queries:**
- `GET /memories?search=...&type=...` — Search memories
- `DELETE /memories/:id` — Soft delete

---

### pages/conversations.vue (Conversation Audit)

**Responsibility:** View user conversation history and interaction patterns.

**Features:**
- List all conversations by user
- View message timeline
- See conversation metadata (intent, context)
- Filter by date, user

**Components:**
- `ConversationList` — Paginated list
- `MessageTimeline` — Chronological messages
- `ConversationDetails` — Metadata panel

**Composables:**
- `useDashboard()` — Fetch conversations
- `useQuery()` — Background refetch

---

### pages/users.vue (User Management, Admin-only)

**Responsibility:** Manage user accounts and roles (admin page).

**Features:**
- List all users
- Edit user roles
- View user activity
- Ban/unban users
- Delete accounts (with confirmation)

**Components:**
- `UserTable` — User list with sorting
- `UserModal` — Edit user dialog
- `RoleSelector` — Role dropdown

**CASL check:** `can('manage', 'users')`

**Queries:**
- `GET /accounts` — List users (admin)
- `PATCH /accounts/:id` — Update user
- `DELETE /accounts/:id` — Delete user

---

### pages/settings.vue (User Preferences)

**Responsibility:** Allow users to update personal settings.

**Features:**
- Theme toggle (light/dark/system)
- Language selection
- Notification preferences
- Connected channels

**Components:**
- `ThemeToggle` — Dark mode switch
- `LanguageSelector` — Language dropdown
- `NotificationPreferences` — Notification settings
- `ChannelList` — Connected messaging platforms

**Stores:**
- `preferencesStore` — Save settings

**Queries:**
- `GET /preferences` — Fetch preferences
- `PATCH /preferences` — Update preferences

---

### pages/analytics.vue (Analytics Dashboard, optional)

**Responsibility:** Detailed analytics and reporting.

**Features:**
- User growth charts
- Memory item breakdown by type
- Conversation metrics
- Enrichment API performance

**Components:**
- `Chart` — Chart.js wrapper
- `MetricCard` — Metric display
- `DateRangePicker` — Filter by date

---

## Component inventory

### Navigation

**Sidebar.vue** — Main navigation menu

```vue
<template>
  <nav class="sidebar">
    <div class="logo">Nexo</div>
    <ul>
      <li><NuxtLink to="/">Dashboard</NuxtLink></li>
      <li><NuxtLink to="/memories">Memories</NuxtLink></li>
      <li><NuxtLink to="/conversations">Conversations</NuxtLink></li>
      <li v-if="can('manage', 'users')"><NuxtLink to="/users">Users</NuxtLink></li>
      <li><NuxtLink to="/settings">Settings</NuxtLink></li>
    </ul>
  </nav>
</template>
```

### Data Display

**AnalyticsCard.vue** — Metric card with icon

- Props: `title`, `value`, `icon`
- Displays single metric with optional trend

**MemoryTable.vue** — Paginated memory list

- Props: `items`, `loading`
- Emits: `delete`, `view-details`
- Features: Sorting, column selection, inline delete

**ConversationList.vue** — Conversation history

- Props: `items`
- Displays: User, date, message count, last message

### Input Components

**SearchBar.vue** — Search with debounce

```vue
<template>
  <input
    :value="modelValue"
    @input="debouncedEmit"
    placeholder="Search memories..."
  />
</template>

<script setup lang="ts">
defineProps<{ modelValue: string }>();
defineEmits<{ (e: 'update:modelValue', value: string): void }>();

const debouncedEmit = useDebounceFn((value) => {
  emit('update:modelValue', value);
}, 300);
</script>
```

**FilterPanel.vue** — Type/tag filters

- Props: `selectedTypes`, `selectedTags`
- Emits: `update:selectedTypes`, `update:selectedTags`

**ThemeToggle.vue** — Dark mode switch

- Uses `preferencesStore`
- Persists to localStorage

### Modals & Dialogs

**MemoryModal.vue** — Memory detail view

- Props: `memory`, `open`
- Emits: `close`, `delete`
- Actions: View, edit metadata, delete

**UserModal.vue** — Edit user dialog

- Props: `user`, `open`
- Actions: Update role, ban, delete

**ConfirmDialog.vue** — Confirmation modal

- Props: `title`, `message`, `onConfirm`
- Used for destructive actions (delete, ban)

### Charts & Visualization

**Chart.vue** — Chart.js wrapper

```vue
<template>
  <canvas ref="chartRef"></canvas>
</template>

<script setup lang="ts">
import { Chart as ChartJS, ... } from 'chart.js';

const chartRef = ref(null);

onMounted(() => {
  new ChartJS(chartRef.value, {
    type: props.type,
    data: props.data,
    options: props.options,
  });
});
</script>
```

---

## Composable inventory

### useDashboard()

Main data-fetching composable. Aggregates queries.

```ts
export const useDashboard = () => {
  const getAnalytics = () => api.get('/analytics');
  const getMemories = (search?, type?) => api.get('/memories', { params: { search, type } });
  const getConversations = () => api.get('/conversations');
  
  const analyticsQuery = useQuery({ queryKey: ['analytics'], queryFn: getAnalytics });
  const memoriesQuery = useQuery({ queryKey: ['memories', search, type], queryFn: () => getMemories(search, type) });
  
  return { analyticsQuery, memoriesQuery, getAnalytics, getMemories, ... };
};
```

### useAuthStore()

Authentication state and methods.

```ts
export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const isAuthenticated = computed(() => !!user.value);
  
  const checkSession = async () => { /* ... */ };
  const logout = () => { /* ... */ };
  
  onMounted(() => checkSession());
  
  return { user, isAuthenticated, checkSession, logout };
});
```

### usePreferencesStore()

User preferences state.

```ts
export const usePreferencesStore = defineStore('preferences', () => {
  const theme = ref<'light' | 'dark' | 'system'>('system');
  const language = ref('pt-BR');
  
  const fetchPreferences = async () => { /* ... */ };
  const updateTheme = async (newTheme) => { /* ... */ };
  
  return { theme, language, fetchPreferences, updateTheme };
});
```

### useAbility()

CASL authorization checks.

```ts
export const useAbility = () => {
  const authStore = useAuthStore();
  
  const ability = defineAbility((can, cannot) => {
    if (authStore.user?.role === 'admin') {
      can('manage', 'all');
    } else {
      can('read', ['memories', 'conversations']);
      can('update', 'user', { id: authStore.user?.id });
    }
  });
  
  return ability;
};
```

---

## Store inventory (Pinia)

### Auth Store

**State:**
- `user: User | null`
- `isAuthenticated: boolean`
- `permissions: string[]`

**Actions:**
- `login(email, password)`
- `loginWithOAuth(provider)`
- `logout()`
- `checkSession()`
- `refreshPermissions()`

### Preferences Store

**State:**
- `theme: 'light' | 'dark' | 'system'`
- `language: 'en' | 'pt-BR'`
- `notifications: { enabled: boolean }`

**Actions:**
- `fetchPreferences()`
- `updateTheme(theme)`
- `updateLanguage(lang)`
- `updateNotifications(config)`

### UI Store

**State:**
- `sidebarOpen: boolean`
- `modalsOpen: Record<string, boolean>`
- `selectedMemoryId: string | null`

**Actions:**
- `toggleSidebar()`
- `openModal(id)`
- `closeModal(id)`
- `selectMemory(id)`

---

## Type definitions (`types/dashboard.ts`)

```ts
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
}

export interface MemoryItem {
  id: string;
  type: 'movie' | 'tv' | 'video' | 'note' | 'link';
  title: string;
  description: string;
  metadata: Record<string, any>;
  tags: string[];
  createdAt: string;
}

export interface Conversation {
  id: string;
  userId: string;
  state: 'active' | 'closed';
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export type ItemType = MemoryItem['type'];
```

---

## Dependency graph

```
Pages
  ├─ components (composition)
  ├─ composables (data fetching)
  └─ stores (state)

Composables
  ├─ stores (access state)
  └─ utils/api (HTTP calls)

Components
  ├─ composables (queries, stores)
  └─ utils (formatters)

Stores
  └─ utils/api (fetch initial data)
```

---

**See also:** [ARCHITECTURE.md](./ARCHITECTURE.md)
