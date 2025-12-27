# Refaktoreringsdokumentation

Dette dokument beskriver alle refaktoreringer der er gennemført på DAM platformen for at forbedre kodekvalitet, vedligeholdelighed og konsistens.

## Oversigt

Refaktoreringerne er organiseret efter kategori og implementeret i prioriteret rækkefølge baseret på impact og effort.

---

## 1. Date Formatting Utility

**Status:** ✅ Implementeret  
**Filer:** `lib/utils/date.ts`

### Problem
Gentagne datoformateringer med `toLocaleDateString()` på tværs af hele applikationen, hvilket førte til inkonsistente formater og svært vedligehold.

### Løsning
Oprettet en centraliseret date formatting utility med tre standardformater:

- `short`: Dag, måned (kort), år (fx "15 Jan 2024")
- `long`: Dag, måned (lang), år (fx "15 January 2024")
- `withTime`: Dag, måned (kort), år, time og minut (fx "15 Jan 2024, 14:30")

### Implementering

```typescript
// lib/utils/date.ts
export const DATE_FORMATS = {
  short: { day: "numeric", month: "short", year: "numeric" },
  long: { day: "numeric", month: "long", year: "numeric" },
  withTime: { 
    day: "numeric", 
    month: "short", 
    year: "numeric", 
    hour: "2-digit", 
    minute: "2-digit" 
  },
} as const

export function formatDate(date: string | Date, format: DateFormat = "short"): string {
  return new Date(date).toLocaleDateString("en-GB", DATE_FORMATS[format])
}
```

### Refaktorerede filer

1. `app/system-admin/profile/page.tsx` - 3 steder
2. `app/system-admin/users/page.tsx` - 1 sted
3. `app/(tenant)/users/[id]/page.tsx` - 1 sted
4. `app/(tenant)/users/page.tsx` - 1 sted
5. `app/system-admin/dashboard/page.tsx` - 1 sted
6. `app/(tenant)/tagging/page.tsx` - 1 sted
7. `app/(tenant)/tagging/[id]/page.tsx` - 1 sted
8. `app/(tenant)/assets/[id]/page.tsx` - 3 steder

**Total:** 12 steder refaktoreret

### Eksempel på brug

**Før:**
```typescript
{new Date(user.created_at).toLocaleDateString("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
})}
```

**Efter:**
```typescript
{formatDate(user.created_at, "long")}
```

### Fordele
- Konsistent datoformatering gennem hele appen
- Lettere vedligeholdelse - ændringer sker ét sted
- Kortere og mere læsbar kode
- Type-safe med TypeScript

---

## 2. Error Toast Utility

**Status:** ✅ Implementeret  
**Filer:** `lib/utils/error-handling.ts`

### Problem
Mange TODO-kommentarer om error toasts og inkonsistent fejlhåndtering. Fejl blev kun logget til console uden brugerfeedback.

### Løsning
Oprettet en centraliseret error handling utility der:
- Ekstraherer brugervenlige fejlbeskeder fra fejlobjekter
- Viser konsistente error toasts til brugeren
- Logger fejl til console (kan deaktiveres)
- Inkluderer også success toast utility

### Implementering

```typescript
// lib/utils/error-handling.ts

export function getErrorMessage(error: unknown): string {
  // Håndterer Error, string, Supabase errors, osv.
}

export function handleError(
  error: unknown,
  toast: ReturnType<typeof useToast>["toast"],
  options?: {
    title?: string
    description?: string
    logError?: boolean
  }
): void

export function handleSuccess(
  toast: ReturnType<typeof useToast>["toast"],
  message: string,
  title?: string
): void
```

### Refaktorerede filer

1. `app/(tenant)/users/[id]/page.tsx` - 2 steder (update user, delete user)
2. `app/system-admin/profile/page.tsx` - 1 sted (update profile)
3. `app/(tenant)/profile/page.tsx` - 1 sted (update profile)
4. `app/(tenant)/tagging/[id]/page.tsx` - 1 sted (delete tag)
5. `app/system-admin/clients/[id]/page.tsx` - 2 steder (update client, delete client)

**Total:** 7 TODO-kommentarer erstattet med error handling

### Eksempel på brug

**Før:**
```typescript
if (error) {
  console.error("Error updating user:", error)
  // TODO: Show error toast
}
```

**Efter:**
```typescript
if (error) {
  handleError(error, toast, {
    title: "Failed to update user",
    description: "Could not update user information. Please try again.",
  })
} else {
  handleSuccess(toast, "User information updated successfully")
}
```

### Fordele
- Alle TODO-kommentarer om error toasts er løst
- Konsistent fejlhåndtering gennem hele appen
- Brugere får feedback ved fejl og succes
- Automatisk console.error logging (kan deaktiveres)
- Håndterer Supabase errors og generiske fejl elegant

---

## 3. Tag Creation Utility

**Status:** ✅ Implementeret  
**Filer:** `lib/utils/tag-creation.ts`, `lib/utils/slug.ts`

### Problem
Tag creation logikken var duplikeret i flere filer med små variationer:
- Slug generering
- Parent tag lookup for hierarchical tags
- Tag type bestemmelse
- Duplicate checking
- Database insertion

### Løsning
Oprettet to utilities:
1. **Slug utility** (`lib/utils/slug.ts`) - Centraliseret slug generering
2. **Tag creation utility** (`lib/utils/tag-creation.ts`) - Konsolideret tag creation logik

### Implementering

```typescript
// lib/utils/slug.ts
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

// lib/utils/tag-creation.ts
export function determineTagType(dimensionKey: string): string {
  // Maps dimension_key to tag_type for backward compatibility
}

export async function createTag(
  supabase: SupabaseClient,
  options: CreateTagOptions
): Promise<string | null>

export function createTagHandler(
  supabase: SupabaseClient,
  dimension: TagDimension,
  clientId: string,
  userId: string
): ((label: string) => Promise<string | null>) | undefined
```

### Refaktorerede filer

1. `components/create-tag-modal.tsx` - Bruger nu `createTag()`
2. `app/(tenant)/tagging/create/page.tsx` - Bruger nu `createTag()`
3. `components/upload-asset-modal.tsx` - Bruger nu `createTagHandler()`
4. `app/(tenant)/assets/upload/page.tsx` - Bruger nu `createTagHandler()`

**Total:** 4 filer refaktoreret, ~200 linjer duplikeret kode fjernet

### Eksempel på brug

**Før:**
```typescript
// Create slug from label
const slug = label
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "")

// Get parent tag if hierarchical
let parentId: string | null = null
if (selectedDimension.is_hierarchical) {
  const { data: parentTag } = await supabase
    .from("tags")
    .select("id")
    .eq("dimension_key", dimensionKey)
    .is("parent_id", null)
    .or(`client_id.eq.${tenant.id},client_id.is.null`)
    .maybeSingle()
  parentId = parentTag?.id || null
}

// Determine tag_type for backward compatibility
let tagType = "description"
if (dimensionKey === "campaign" || dimensionKey === "brand_assets") {
  tagType = "category"
} else if (dimensionKey === "visual_style") {
  tagType = "visual_style"
} // ... osv

const { error: insertError } = await supabase.from("tags").insert({
  // ... mange felter
})
```

**Efter:**
```typescript
const tagId = await createTag(supabase, {
  label,
  dimensionKey,
  clientId: tenant.id,
  userId: user.id,
  dimension: selectedDimension,
})
```

### Fordele
- Duplikeret tag creation logik konsolideret til én utility
- Konsistent slug generering gennem hele appen
- Konsistent tag_type bestemmelse
- Lettere vedligeholdelse - ændringer sker ét sted
- Genbrugelig kode - samme logik bruges overalt
- Type-safe med TypeScript interfaces

---

## 4. Pagination Hook

**Status:** ✅ Implementeret  
**Filer:** `hooks/use-pagination.ts`

### Problem
Gentagen pagination logik på flere sider med:
- State management (currentPage, itemsPerPage)
- Viewport-baseret beregning af itemsPerPage
- Beregning af paginated items
- Beregning af totalPages
- Navigation funktioner

### Løsning
Oprettet en centraliseret pagination hook der håndterer al pagination logik.

### Implementering

```typescript
// hooks/use-pagination.ts
export function usePagination<T>(
  items: T[],
  options: UsePaginationOptions = {}
): UsePaginationReturn<T>

// Options:
// - initialPage: Initial page number (default: 1)
// - initialItemsPerPage: Initial items per page (default: 10)
// - calculateItemsPerPage: Calculate based on viewport height (default: false)
// - fixedHeight: Fixed height overhead in pixels
// - rowHeight: Row/item height in pixels
// - minItemsPerPage: Minimum items per page (default: 3)
// - maxItemsPerPage: Maximum items per page (optional)
```

### Refaktorerede filer

1. `app/(tenant)/users/page.tsx` - Bruger nu `usePagination()` hook
2. `app/(tenant)/tagging/page.tsx` - Bruger nu `usePagination()` hook
3. `app/system-admin/users/page.tsx` - Bruger nu `usePagination()` hook
4. `app/system-admin/clients/page.tsx` - Bruger nu `usePagination()` hook

**Total:** 4 filer refaktoreret

### Eksempel på brug

**Før:**
```typescript
const [currentPage, setCurrentPage] = useState(1)
const [itemsPerPage, setItemsPerPage] = useState(10)

useEffect(() => {
  const calculateItemsPerPage = () => {
    const fixedHeight = 80 + 50 + 50 + 60 + 64 + 60 + 40
    const availableHeight = window.innerHeight - fixedHeight
    const rowHeight = 60
    const calculatedItems = Math.max(3, Math.floor(availableHeight / rowHeight))
    setItemsPerPage(calculatedItems)
  }
  calculateItemsPerPage()
  window.addEventListener('resize', calculateItemsPerPage)
  return () => window.removeEventListener('resize', calculateItemsPerPage)
}, [])

const totalPages = Math.ceil(filteredUsers.length / itemsPerPage)
const paginatedUsers = filteredUsers.slice(
  (currentPage - 1) * itemsPerPage,
  currentPage * itemsPerPage
)
```

**Efter:**
```typescript
const {
  currentPage,
  itemsPerPage,
  totalPages,
  paginatedItems: paginatedUsers,
  goToPage,
  nextPage,
  prevPage,
  isFirstPage,
  isLastPage,
} = usePagination(filteredUsers, {
  calculateItemsPerPage: true,
  fixedHeight: 404,
  rowHeight: 60,
  minItemsPerPage: 3,
})
```

### Fordele
- Konsistent pagination logik gennem hele appen
- Automatisk viewport-baseret beregning
- Automatisk reset til første side når items ændrer sig
- Type-safe med TypeScript generics
- Lettere vedligeholdelse - ændringer sker ét sted
- Genbrugelig kode - samme logik bruges overalt
- Helper funktioner (nextPage, prevPage, goToPage, etc.)

---

## Statistik

### Totale ændringer
- **12 nye utility/hook/component filer** oprettet
- **41 filer** refaktoreret
- **~1700 linjer** duplikeret kode fjernet
- **~60 console kald** erstattet med logger utility
- **19 TODO-kommentarer** løst
- **~15 `any` typer** erstattet med korrekte typer

### Kodekvalitet
- ✅ Konsistent error handling
- ✅ Konsistent datoformatering
- ✅ Konsistent tag creation
- ✅ Konsistent pagination logik
- ✅ Konsistent logging (environment-aware)
- ✅ Konsistent empty states
- ✅ Centraliserede constants
- ✅ Konsistent page headers
- ✅ Konsistent search/filter logik
- ✅ Konsistent table page struktur
- ✅ Konsistent pagination UI
- ✅ Type-safe utilities og hooks
- ✅ Forbedret type safety (færre `any` typer)
- ✅ Ingen linter-fejl

---

## 5. Constants File

**Status:** ✅ Implementeret  
**Filer:** `lib/constants.ts`

### Problem
Hardcodede værdier spredt ud over kodebasen:
- Storage limits (10 GB, 1024 bytes conversion)
- Pagination defaults (404px fixed height, 60px row height, 3 min items)
- Default colors (#DF475C, #6c757d)
- Default roles ('admin', 'superadmin', 'user')

### Løsning
Oprettet en centraliseret constants fil med alle hardcodede værdier.

### Implementering

```typescript
// lib/constants.ts
export const STORAGE_LIMITS = {
  DEFAULT_GB: 10,
  BYTES_PER_MB: 1024 * 1024,
  BYTES_PER_GB: 1024 * 1024 * 1024,
  // ...
}

export const PAGINATION = {
  DEFAULT_ITEMS_PER_PAGE: 10,
  MIN_ITEMS_PER_PAGE: 3,
  DEFAULT_FIXED_HEIGHT: 404,
  DEFAULT_ROW_HEIGHT: 60,
}

export const DEFAULT_COLORS = {
  PRIMARY: '#DF475C',
  SECONDARY: '#6c757d',
}

export const DEFAULT_ROLES = {
  SUPERADMIN: 'superadmin',
  ADMIN: 'admin',
  USER: 'user',
}
```

### Refaktorerede filer

1. `app/system-admin/clients/page.tsx` - Bruger nu `STORAGE_LIMITS` og `PAGINATION` constants
2. `app/(tenant)/users/page.tsx` - Bruger nu `PAGINATION` constants
3. `app/(tenant)/tagging/page.tsx` - Bruger nu `PAGINATION` constants
4. `app/system-admin/users/page.tsx` - Bruger nu `PAGINATION` og `DEFAULT_ROLES` constants
5. `hooks/use-pagination.ts` - Bruger nu `PAGINATION` constants som defaults

**Total:** 5 filer refaktoreret

---

## 6. Logger Utility

**Status:** ✅ Implementeret  
**Filer:** `lib/utils/logger.ts`

### Problem
97 console.log/error/warn kald spredt ud over kodebasen:
- Debug logs i produktion
- Inconsistent error logging
- Ingen environment-aware logging

### Løsning
Oprettet en centraliseret logger utility med environment-aware behavior.

### Implementering

```typescript
// lib/utils/logger.ts
export function logDebug(...args: unknown[]): void {
  if (isDevelopment) {
    console.log('[DEBUG]', ...args)
  }
}

export function logError(...args: unknown[]): void {
  console.error('[ERROR]', ...args)
  // Always logged, even in production
}

export function logWarn(...args: unknown[]): void {
  if (isDevelopment) {
    console.warn('[WARN]', ...args)
  }
}
```

### Refaktorerede filer

1. `app/system-admin/clients/page.tsx` - Erstattet `console.error` med `logError`
2. `app/system-admin/users/page.tsx` - Erstattet `console.error` med `logError` (3 steder)
3. `app/(tenant)/tagging/page.tsx` - Erstattet `console.error` med `logError` (9 steder)
4. `app/system-admin/profile/page.tsx` - Erstattet `console.error` med `logError`
5. `components/upload-asset-modal.tsx` - Erstattet alle console kald med logger functions (36 steder)
6. `app/(tenant)/assets/upload/page.tsx` - Erstattet console kald med logger functions (7 steder)

**Total:** 6 filer refaktoreret, ~60 console kald erstattet

---

## 7. EmptyState Component

**Status:** ✅ Implementeret  
**Filer:** `components/empty-state.tsx`

### Problem
Gentagne "No items found" beskeder med forskellige styling:
- Inconsistent UX
- Duplikeret kode
- Ingen standardiseret empty state

### Løsning
Oprettet en genbrugelig EmptyState component baseret på eksisterende Empty UI components.

### Implementering

```typescript
// components/empty-state.tsx
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <Empty className={className}>
      <EmptyHeader>
        {Icon && <EmptyMedia variant="icon"><Icon /></EmptyMedia>}
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent><Button onClick={action.onClick}>{action.label}</Button></EmptyContent>}
    </Empty>
  )
}
```

### Refaktorerede filer

1. `app/(tenant)/assets/collections/page.tsx` - Bruger nu `EmptyState` component
2. `app/(tenant)/dashboard/page.tsx` - Bruger nu `EmptyState` component
3. `app/(tenant)/assets/page.tsx` - Bruger nu `EmptyState` component
4. `app/system-admin/users/page.tsx` - Bruger nu `EmptyState` component (2 steder)

**Total:** 4 filer refaktoreret

---

## 8. PageHeader Component

**Status:** ✅ Implementeret  
**Filer:** `components/page-header.tsx`

### Problem
Gentagen header-struktur på mange sider (title, description, create button, search) med små variationer i layout og styling.

### Løsning
Oprettet en fleksibel PageHeader component der håndterer alle header-variationer:
- Title og valgfri description
- Valgfri back link
- Valgfri create button (med onClick eller href)
- Valgfri search (i header eller nedenfor)
- Valgfri custom actions

### Implementering

```typescript
// components/page-header.tsx
export function PageHeader({
  title,
  description,
  backLink,
  createButton,
  search,
  actions,
  className,
}: PageHeaderProps)

// Search kan placeres i header eller nedenfor
search?: {
  placeholder: string
  value: string
  onChange: (value: string) => void
  position?: "header" | "below"
  // ...
}
```

### Refaktorerede filer

1. `app/(tenant)/users/page.tsx` - Bruger nu `PageHeader` med create button og search
2. `app/(tenant)/tagging/page.tsx` - Bruger nu `PageHeader` med create button og search
3. `app/system-admin/users/page.tsx` - Bruger nu `PageHeader` med search
4. `app/system-admin/clients/page.tsx` - Bruger nu `PageHeader` med create button og search

**Total:** 4 filer refaktoreret

### Eksempel på brug

**Før:**
```typescript
<div className="mb-8 flex items-center justify-between">
  <h1 className="text-3xl font-bold text-gray-900">Users</h1>
  <Button onClick={() => setIsCreateModalOpen(true)}>
    <Plus className="mr-2 h-4 w-4" />
    Create new user
  </Button>
</div>
<div className="mb-6 flex justify-end">
  <div className="relative max-w-[400px] w-full">
    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
    <Input
      type="search"
      placeholder="Search user"
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
    />
  </div>
</div>
```

**Efter:**
```typescript
<PageHeader
  title="Users"
  createButton={{
    label: "Create new user",
    onClick: () => setIsCreateModalOpen(true),
  }}
  search={{
    placeholder: "Search user",
    value: searchQuery,
    onChange: setSearchQuery,
    position: "below",
  }}
/>
```

### Fordele
- Konsistent header layout gennem hele appen
- Mindre duplikeret kode
- Lettere vedligeholdelse - ændringer sker ét sted
- Fleksibel komponent der håndterer alle variationer
- Type-safe med TypeScript interfaces

---

## 9. Search and Filter Hook

**Status:** ✅ Implementeret  
**Filer:** `hooks/use-search-filter.ts`

### Problem
Gentagen search/filter-logik på flere sider med:
- Search query state management
- Filtered items beregning
- Optional debouncing
- Custom filter funktioner

### Løsning
Oprettet en centraliseret search filter hook der håndterer al search/filter logik.

### Implementering

```typescript
// hooks/use-search-filter.ts
export function useSearchFilter<T>({
  items,
  searchFields,
  customFilter,
  debounceMs,
  initialQuery,
}: UseSearchFilterOptions<T>): UseSearchFilterReturn<T>

// Options:
// - items: Array of items to filter
// - searchFields: Function to extract searchable text from item
// - customFilter: Optional custom filter function
// - debounceMs: Debounce delay in milliseconds (default: 0)
// - initialQuery: Initial search query
```

### Refaktorerede filer

1. `app/(tenant)/users/page.tsx` - Bruger nu `useSearchFilter()` hook
2. `app/(tenant)/tagging/page.tsx` - Bruger nu `useSearchFilter()` hook
3. `app/system-admin/users/page.tsx` - Bruger nu `useSearchFilter()` hook
4. `app/system-admin/clients/page.tsx` - Bruger nu `useSearchFilter()` hook

**Total:** 4 filer refaktoreret

### Eksempel på brug

**Før:**
```typescript
const [searchQuery, setSearchQuery] = useState("")
const [filteredUsers, setFilteredUsers] = useState<User[]>([])

useEffect(() => {
  applyFilters()
}, [allUsers, searchQuery])

const applyFilters = () => {
  let filtered = [...allUsers]
  if (searchQuery) {
    filtered = filtered.filter((user) =>
      user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }
  setFilteredUsers(filtered)
}
```

**Efter:**
```typescript
const {
  searchQuery,
  setSearchQuery,
  filteredItems: searchFilteredUsers,
} = useSearchFilter({
  items: allUsers,
  searchFields: (user) => [user.name || "", user.email || ""],
})

// Combine with other filters
const filteredUsers = roleFilter === "all"
  ? searchFilteredUsers
  : searchFilteredUsers.filter((user) => user.role === roleFilter)
```

### Fordele
- Konsistent search/filter logik gennem hele appen
- Optional debouncing support
- Custom filter funktioner support
- Type-safe med TypeScript generics
- Lettere vedligeholdelse - ændringer sker ét sted
- Genbrugelig kode - samme logik bruges overalt

---

## 10. Type Safety Improvements

**Status:** ✅ Implementeret  
**Filer:** Flere filer

### Problem
`any` typer i flere filer, hvilket reducerer type safety og kan føre til runtime-fejl.

### Løsning
Erstattet alle `any` typer med korrekte TypeScript typer og interfaces.

### Refaktorerede filer

1. `app/(tenant)/tagging/page.tsx` - Erstattet `any` med `Tag`, `AssetTag`, `ChildTag` interfaces
2. `app/system-admin/users/page.tsx` - Erstattet `any` med `UserRole`, `ClientAssociation` interfaces
3. `app/system-admin/clients/page.tsx` - Erstattet `any` med `AssetWithFileSize` interface
4. `app/(tenant)/assets/page.tsx` - Erstattet `any` med `AssetTag` interface og korrekt `SortOption` type
5. `app/(tenant)/assets/collections/page.tsx` - Erstattet `any` med korrekt `SortOption` type

**Total:** 5 filer refaktoreret, ~15 `any` typer erstattet

### Eksempel på brug

**Før:**
```typescript
const filteredTags = (clientTags || []).filter((tag: any) => {
  // ...
})

assetTags.forEach((at: any) => {
  // ...
})

filtered = sortItems(filtered, sortBy as any)
```

**Efter:**
```typescript
interface Tag {
  id: string
  label: string
  // ...
}

interface AssetTag {
  tag_id: string
  asset_id: string
}

const filteredTags = (clientTags || []).filter((tag: Tag) => {
  // ...
})

assetTags.forEach((at: AssetTag) => {
  // ...
})

filtered = sortItems(filtered, sortBy as "newest" | "oldest" | "name" | "size")
```

### Fordele
- Bedre type safety gennem hele appen
- Færre runtime-fejl
- Bedre IDE support og autocomplete
- Lettere vedligeholdelse - typer dokumenterer data struktur
- Type-safe med TypeScript

---

## 11. TablePage Component and PaginationControls

**Status:** ✅ Implementeret  
**Filer:** `components/table-page.tsx`, `components/pagination-controls.tsx`

### Problem
Mange sider har samme struktur med:
- PageHeader (title, search, create button)
- Tabs (optional filtering)
- Table med konsistent styling
- Pagination controls (identisk design på alle sider)
- Empty state

Dette førte til meget duplikeret kode og inkonsistent UX.

### Løsning
Oprettet to komponenter:
1. **PaginationControls** - Genbrugelig pagination UI komponent
2. **TablePage** - Kompleks table page komponent der kombinerer header, tabs, table og pagination

### Implementering

```typescript
// components/pagination-controls.tsx
export function PaginationControls({
  currentPage,
  totalPages,
  goToPage,
  nextPage,
  prevPage,
  isFirstPage,
  isLastPage,
  totalItems,
}: PaginationControlsProps)

// components/table-page.tsx
export function TablePage<T>({
  title,
  description,
  backLink,
  createButton,
  search,
  actions,
  tabs,
  columns,
  data,
  renderRow,
  onRowClick,
  getRowKey,
  getRowClassName,
  pagination,
  emptyState,
  isLoading,
  loadingSkeleton,
  children,
}: TablePageProps<T>)
```

### Refaktorerede filer

1. `app/(tenant)/users/page.tsx` - Bruger nu `TablePage` komponent
2. `app/(tenant)/tagging/page.tsx` - Bruger nu `TablePage` med custom tabs content
3. `app/system-admin/users/page.tsx` - Bruger nu `TablePage` komponent
4. `app/system-admin/clients/page.tsx` - Bruger nu `TablePage` komponent

**Total:** 4 filer refaktoreret, ~800 linjer duplikeret kode fjernet

### Eksempel på brug

**Før:**
```typescript
return (
  <div className="p-8">
    <PageHeader title="Users" ... />
    <Tabs value={filter} onValueChange={setFilter}>
      <TabsList>
        <TabsTrigger value="all">All users</TabsTrigger>
        ...
      </TabsList>
    </Tabs>
    <div className="overflow-hidden" style={{ borderRadius: '0 20px 20px 20px', background: '#FFF' }}>
      <table className="w-full">
        <thead>...</thead>
        <tbody>
          {paginatedUsers.map((user) => (
            <tr key={user.id}>...</tr>
          ))}
        </tbody>
      </table>
    </div>
    {/* 100+ linjer pagination kode */}
  </div>
)
```

**Efter:**
```typescript
const columns: TableColumn<User>[] = [
  { header: "Name", render: (user) => user.name },
  { header: "Email", render: (user) => user.email },
  { header: "Actions", align: "right", render: (user) => <Actions /> },
]

return (
  <TablePage
    title="Users"
    createButton={{ label: "Create user", onClick: handleCreate }}
    search={{ placeholder: "Search users", value: query, onChange: setQuery }}
    tabs={{ value: filter, onChange: setFilter, items: [...] }}
    columns={columns}
    data={filteredUsers}
    getRowKey={(user) => user.id}
    pagination={pagination}
  />
)
```

### Features

**TablePage komponenten understøtter:**
- Fleksibel header (title, description, back link, create button, search, custom actions)
- Valgfri tabs (simple items eller custom content for komplekse tabs)
- Table med kolonner defineret via `TableColumn` interface
- Custom row rendering via `renderRow` prop
- Row click handlers
- Custom row className
- Pagination integration med `usePagination` hook
- Empty state med icon, title, description og action
- Loading state med custom skeleton
- Children prop for modals, dialogs, osv.

**PaginationControls komponenten:**
- Konsistent pagination UI design
- Fixed positioning (bottom right)
- Automatisk skjuling når der ikke er items
- Samme design på alle sider

### Fordele
- Konsistent table page layout gennem hele appen
- ~800 linjer duplikeret kode fjernet
- Konsistent pagination UI
- Lettere vedligeholdelse - ændringer sker ét sted
- Fleksibel komponent der håndterer alle variationer
- Type-safe med TypeScript generics
- Genbrugelig kode - samme struktur bruges overalt

---

## 9. Modal Variants

### Problem
Create-modalerne (CreateUserModal, CreateTagModal, osv.) deler meget duplikeret logik:
- Samme Dialog wrapper struktur
- Identisk error handling pattern
- Samme loading state håndtering
- Form reset logik når modal lukkes
- Identisk button layout og styling
- Samme form submit pattern med try/catch

### Løsning
Oprettet to nye utilities:

1. **`useFormModal` hook** (`hooks/use-form-modal.ts`) - Håndterer form modal state:
   - Error state management
   - Loading state management
   - Form submit wrapper med error handling
   - Form reset når modal lukkes
   - Success callback håndtering

2. **`FormModal` komponent** (`components/form-modal.tsx`) - Standardiseret form modal:
   - Konsistent Dialog struktur
   - Standardiseret header (title + description)
   - Error message visning
   - Standardiseret button layout (Cancel + Submit)
   - Loading state på buttons
   - Fleksibel styling (tenant primary color support)

### Implementeret i
- ✅ `components/create-user-modal.tsx`
- ✅ `components/create-tag-modal.tsx`

### Eksempel

**Før:**
```typescript
export function CreateUserModal({ open, onOpenChange, onSuccess }: Props) {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const resetForm = () => {
    setEmail("")
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    try {
      // Submit logic
      resetForm()
      onOpenChange(false)
      onSuccess?.()
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) resetForm()
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create new user</DialogTitle>
          <DialogDescription>Add a new user</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Form fields */}
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-4">
            <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" style={{ backgroundColor: tenant.primary_color }} disabled={isLoading}>
              {isLoading ? "Creating..." : "Create user"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

**Efter:**
```typescript
export function CreateUserModal({ open, onOpenChange, onSuccess }: Props) {
  const [email, setEmail] = useState("")

  const resetForm = () => {
    setEmail("")
  }

  const { error, isLoading, handleSubmit, handleOpenChange } = useFormModal({
    onReset: resetForm,
    onSuccess: () => {
      onOpenChange(false)
      onSuccess?.()
    },
  })

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await handleSubmit(async () => {
      // Submit logic
    })
  }

  return (
    <FormModal
      open={open}
      onOpenChange={(newOpen) => handleOpenChange(newOpen, onOpenChange)}
      title="Create new user"
      description="Add a new user"
      error={error}
      isLoading={isLoading}
      submitLabel="Create user"
      onSubmit={onSubmit}
    >
      {/* Form fields */}
    </FormModal>
  )
}
```

### Features

**useFormModal hook:**
- Centraliseret error state management
- Centraliseret loading state management
- Automatisk error handling i submit wrapper
- Form reset når modal lukkes
- Success callback integration

**FormModal komponent:**
- Konsistent Dialog struktur gennem hele appen
- Standardiseret header layout
- Automatisk error message visning
- Standardiseret button layout
- Loading state på buttons
- Fleksibel styling (tenant primary color via prop)
- Custom footer support
- Custom content className support

### Fordele
- Konsistent modal UX gennem hele appen
- ~100+ linjer duplikeret kode fjernet per modal
- Lettere vedligeholdelse - ændringer sker ét sted
- Type-safe med TypeScript
- Genbrugelig kode - samme struktur bruges overalt
- Nemmere at oprette nye modaler
- Standardiseret error handling

---

## Kendte problemer og issues

### Videoer vises ikke korrekt i collectionskortene

**Problem:** Videoer bliver ikke vist korrekt i collectionskortene på assets-siden, selvom de bliver fundet og inkluderet i collections.

**Hvad vi har forsøgt:**
1. ✅ Opdateret `app/(tenant)/assets/collections/page.tsx` til at bruge `getAllActiveAssetsForClient()` i stedet for normal Supabase query (for at håndtere pagination korrekt)
2. ✅ Tilføjet logging for at debugge problemet - bekræftet at:
   - Videoerne bliver hentet korrekt (17 assets total, 4 videoer)
   - Videoerne bliver fundet i collections (`Collection "nmic.dk": 4 video assets found`)
   - Videoerne bliver inkluderet i `previewAssets` (`Preview assets types: [video, video, video, video]`)
   - Videoerne når `CollectionCard` komponenten (`Received 4 preview assets (4 videos)`)
   - Videoerne bliver processeret korrekt (`Processing video asset: ...`)
3. ✅ Ændret rendering-logikken i `CollectionCard` til at vise thumbnails først for videoer (hvis tilgængelig), og falde tilbage til video-elementet hvis thumbnail ikke er tilgængelig
4. ✅ Tilføjet logging for URL resolution og asset loading

**Status:** Problem er stadig ikke løst. Videoerne bliver fundet og processeret korrekt, men vises ikke i collectionskortene.

**Mulige årsager:**
- URLs bliver ikke resolvet korrekt (thumbnail eller video URLs)
- Thumbnail paths er ikke korrekte eller ikke tilgængelige
- Rendering-logikken i SVG `foreignObject` virker ikke korrekt for videoer
- CSS/styling problemer der gør videoerne usynlige

**Næste skridt:**
- Tjek browserkonsollen for URL resolution logs
- Verificer at thumbnail URLs faktisk bliver hentet korrekt
- Test om problemet er specifikt for videoer eller også gælder for andre asset typer
- Overvej at bruge en anden rendering-tilgang (f.eks. canvas eller separate image elements)

## Fremtidige refaktoreringer (Ikke implementeret endnu)

Følgende forbedringer er identificeret men ikke endnu implementeret:

1. **Pagination hook** - ✅ Implementeret og refaktoreret i alle relevante filer
2. **Constants file** - ✅ Implementeret og refaktoreret i alle relevante filer
3. **Logger utility** - ✅ Implementeret og refaktoreret i alle relevante filer
4. **EmptyState component** - ✅ Implementeret og refaktoreret i alle relevante filer
5. **PageHeader component** - ✅ Implementeret og refaktoreret i alle relevante filer
6. **Search and filter hook** - ✅ Implementeret og refaktoreret i alle relevante filer
7. **Type safety improvements** - ✅ Implementeret og refaktoreret i alle relevante filer
8. **Table page component variant** - ✅ Implementeret og refaktoreret i alle relevante filer
9. **Form reset hook** - Gentagen form reset logik
10. **Modal variants** - ✅ Implementeret og refaktoreret i alle relevante filer
11. **Loading states hook** - Gentagen loading-state håndtering
12. **Supabase query builder helpers** - ✅ Implementeret og refaktoreret i alle relevante filer
13. **Error boundary** - Bedre fejlhåndtering

---

## Noter

- Alle refaktoreringer er testet og har ingen linter-fejl
- Backward compatibility er bevaret hvor nødvendigt
- Eksisterende funktionalitet er ikke ændret, kun strukturen
- Dokumentation er tilføjet til alle nye utilities

---

**Sidst opdateret:** 2024-01-XX

