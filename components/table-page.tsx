"use client"

import { ReactNode } from "react"
import { LucideIcon } from "lucide-react"
import { PageHeader, PageHeaderProps } from "@/components/page-header"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PaginationControls } from "@/components/pagination-controls"
import { UsePaginationReturn } from "@/hooks/use-pagination"
import { EmptyState } from "@/components/empty-state"

export interface TableColumn<T> {
  header: string | ReactNode
  accessor?: keyof T
  render?: (item: T) => ReactNode
  className?: string
  align?: "left" | "right" | "center"
}

export interface TablePageTabs {
  value: string
  onChange: (value: string) => void
  items?: Array<{
    value: string
    label: string
  }>
  content?: ReactNode // Custom tabs content (for complex tabs like dropdown menus)
}

export interface TablePageProps<T> {
  // Header props
  title: string
  description?: string
  backLink?: PageHeaderProps["backLink"]
  createButton?: PageHeaderProps["createButton"]
  search?: PageHeaderProps["search"]
  actions?: PageHeaderProps["actions"]
  
  // Tabs (optional)
  tabs?: TablePageTabs
  
  // Table props
  columns: TableColumn<T>[]
  data: T[]
  renderRow?: (item: T, index: number) => ReactNode
  onRowClick?: (item: T) => void
  getRowKey: (item: T) => string
  getRowClassName?: (item: T) => string
  
  // Pagination props
  pagination: UsePaginationReturn<T>
  
  // Empty state
  emptyState?: {
    icon: LucideIcon
    title: string
    description?: string
    action?: {
      label: string
      onClick: () => void
    }
  }
  
  // Loading state
  isLoading?: boolean
  loadingSkeleton?: ReactNode
  
  // Additional content (modals, dialogs, etc.)
  children?: ReactNode
  
  className?: string
}

/**
 * Reusable table page component that combines:
 * - PageHeader (title, search, create button)
 * - Tabs (optional filtering)
 * - Table with consistent styling
 * - Pagination controls
 * - Empty state
 * 
 * @example
 * ```tsx
 * <TablePage
 *   title="Users"
 *   createButton={{ label: "Create user", onClick: handleCreate }}
 *   search={{ placeholder: "Search users", value: query, onChange: setQuery }}
 *   tabs={{ value: filter, onChange: setFilter, items: [...] }}
 *   columns={columns}
 *   data={paginatedUsers}
 *   pagination={pagination}
 *   emptyState={{ icon: Users, title: "No users found" }}
 * />
 * ```
 */
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
  className = "",
}: TablePageProps<T>) {
  const {
    currentPage,
    totalPages,
    paginatedItems,
    goToPage,
    nextPage,
    prevPage,
    isFirstPage,
    isLastPage,
  } = pagination

  if (isLoading && loadingSkeleton) {
    return <div className={`p-8 ${className}`}>{loadingSkeleton}</div>
  }

  return (
    <div className={`p-8 ${className}`}>
      <PageHeader
        title={title}
        description={description}
        backLink={backLink}
        createButton={createButton}
        search={search}
        actions={actions}
      />
      
      {children}

      {tabs && (
        <Tabs value={tabs.value} onValueChange={tabs.onChange} className="mb-0">
          {tabs.content ? (
            tabs.content
          ) : tabs.items ? (
            <TabsList suppressHydrationWarning>
              {tabs.items.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          ) : null}
        </Tabs>
      )}

      {data.length === 0 && emptyState ? (
        <EmptyState
          icon={emptyState.icon as LucideIcon}
          title={emptyState.title}
          description={emptyState.description}
          action={emptyState.action}
        />
      ) : (
        <>
          <div className="overflow-hidden" style={{ borderRadius: '0 20px 20px 20px', background: '#FFF' }}>
            <table className="w-full">
              <thead>
                <tr className="rounded-[20px] bg-[#F9F9F9]">
                  {columns.map((column, index) => {
                    const isFirst = index === 0
                    const isLast = index === columns.length - 1
                    const align = column.align || "left"
                    
                    return (
                      <th
                        key={index}
                        className={`px-6 py-3 text-${align} text-sm font-medium text-gray-900 ${
                          isFirst ? 'first:pl-6' : ''
                        } ${isLast ? 'last:pr-6' : ''} ${column.className || ''}`}
                      >
                        {column.header}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {renderRow
                  ? paginatedItems.map((item, index) => renderRow(item, index))
                  : paginatedItems.map((item, index) => {
                      const rowKey = getRowKey(item)
                      const rowClassName = getRowClassName?.(item) || ""
                      const hasClickHandler = onRowClick !== undefined
                      
                      return (
                        <tr
                          key={rowKey}
                          className={`border-b border-gray-100 last:border-b-0 ${rowClassName} ${
                            hasClickHandler ? 'cursor-pointer hover:bg-gray-50/50' : ''
                          }`}
                          onClick={onRowClick ? () => onRowClick(item) : undefined}
                        >
                          {columns.map((column, colIndex) => {
                            const align = column.align || "left"
                            const isFirst = colIndex === 0
                            const isLast = colIndex === columns.length - 1
                            
                            return (
                              <td
                                key={colIndex}
                                className={`px-6 py-4 text-sm ${
                                  align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
                                } ${
                                  colIndex === 0 ? 'text-gray-900' : 'text-gray-600'
                                } ${column.className || ''}`}
                              >
                                {column.render
                                  ? column.render(item)
                                  : column.accessor
                                  ? String(item[column.accessor] ?? '')
                                  : ''}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
              </tbody>
            </table>
          </div>

          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            goToPage={goToPage}
            nextPage={nextPage}
            prevPage={prevPage}
            isFirstPage={isFirstPage}
            isLastPage={isLastPage}
            totalItems={data.length}
          />
        </>
      )}
    </div>
  )
}

