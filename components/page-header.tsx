"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, ArrowLeft, Plus } from "lucide-react"
import Link from "next/link"
import { ReactNode } from "react"

export interface PageHeaderProps {
  title: string
  description?: string
  backLink?: {
    href: string
    label?: string
  }
  createButton?: {
    label: string
    onClick?: () => void
    href?: string
    icon?: ReactNode
    variant?: "default" | "secondary"
    className?: string
    style?: React.CSSProperties
  }
  search?: {
    placeholder: string
    value: string
    onChange: (value: string) => void
    className?: string
    maxWidth?: string
    position?: "header" | "below" // Position of search: in header or below header
  }
  actions?: ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  backLink,
  createButton,
  search,
  actions,
  className = "",
}: PageHeaderProps) {
  const searchPosition = search?.position || "header"

  return (
    <div className={`mb-8 ${className}`}>
      {backLink && (
        <Link
          href={backLink.href}
          className="mb-4 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLink.label || "Back"}
        </Link>
      )}

      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
          {description && (
            <p className="mt-1 text-gray-500">{description}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {search && searchPosition === "header" && (
            <div className={`relative ${search.maxWidth || "w-64"}`}>
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
              <Input
                type="search"
                placeholder={search.placeholder}
                className={`pl-10 bg-white text-[#737373] placeholder:text-[#737373] ${search.className || ""}`}
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
              />
            </div>
          )}

          {actions}

          {createButton && (
            <>
              {createButton.href ? (
                <Link href={createButton.href}>
                  <Button
                    variant={createButton.variant || "default"}
                    className={createButton.className}
                    style={createButton.style}
                  >
                    {createButton.icon || <Plus className="mr-2 h-4 w-4" />}
                    {createButton.label}
                  </Button>
                </Link>
              ) : (
                <Button
                  onClick={createButton.onClick}
                  variant={createButton.variant || "default"}
                  className={createButton.className}
                  style={createButton.style}
                >
                  {createButton.icon || <Plus className="mr-2 h-4 w-4" />}
                  {createButton.label}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Search below header */}
      {search && searchPosition === "below" && (
        <div className="mb-6 flex justify-end">
          <div className={`relative ${search.maxWidth || "max-w-[400px] w-full"}`}>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
            <Input
              type="search"
              placeholder={search.placeholder}
              className={`pl-10 bg-white text-[#737373] placeholder:text-[#737373] ${search.className || ""}`}
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export interface PageHeaderWithSearchProps {
  title: string
  search: {
    placeholder: string
    value: string
    onChange: (value: string) => void
    className?: string
  }
  className?: string
}

/**
 * Simplified header component for pages that only need title and search
 * Search is displayed below the title, aligned to the right
 */
export function PageHeaderWithSearch({
  title,
  search,
  className = "",
}: PageHeaderWithSearchProps) {
  return (
    <div className={`mb-8 ${className}`}>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
      </div>

      {/* Search */}
      <div className="mb-6 flex justify-end">
        <div className="relative max-w-[400px] w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
          <Input
            type="search"
            placeholder={search.placeholder}
            className={`pl-10 bg-white text-[#737373] placeholder:text-[#737373] ${search.className || ""}`}
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}

