"use client"

import type React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export interface FormModalProps {
  /**
   * Whether the modal is open
   */
  open: boolean
  /**
   * Callback when modal open state changes
   */
  onOpenChange: (open: boolean) => void
  /**
   * Modal title
   */
  title: string
  /**
   * Modal description
   */
  description: string
  /**
   * Form content (children)
   */
  children: React.ReactNode
  /**
   * Error message to display
   */
  error?: string | null
  /**
   * Loading state
   */
  isLoading?: boolean
  /**
   * Submit button label (default: "Create")
   */
  submitLabel?: string
  /**
   * Loading button label (default: "Creating...")
   */
  loadingLabel?: string
  /**
   * Cancel button label (default: "Cancel")
   */
  cancelLabel?: string
  /**
   * Submit button variant/style
   */
  submitButtonStyle?: React.CSSProperties
  /**
   * Custom submit button className
   */
  submitButtonClassName?: string
  /**
   * Custom DialogContent className
   */
  contentClassName?: string
  /**
   * Whether to show cancel button (default: true)
   */
  showCancel?: boolean
  /**
   * Custom footer content (overrides default buttons)
   */
  footer?: React.ReactNode
  /**
   * Form submit handler
   */
  onSubmit: (e: React.FormEvent) => void
  /**
   * Callback when cancel is clicked
   */
  onCancel?: () => void
}

/**
 * Standardized form modal component with consistent structure and styling
 * 
 * @example
 * ```tsx
 * <FormModal
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   title="Create new user"
 *   description="Add a new user to your organization"
 *   error={error}
 *   isLoading={isLoading}
 *   onSubmit={handleSubmit}
 * >
 *   <div className="space-y-4">
 *     <Input ... />
 *   </div>
 * </FormModal>
 * ```
 */
export function FormModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  error,
  isLoading = false,
  submitLabel = "Create",
  loadingLabel = "Creating...",
  cancelLabel = "Cancel",
  submitButtonStyle,
  submitButtonClassName,
  contentClassName = "max-w-2xl max-h-[90vh] overflow-y-auto",
  showCancel = true,
  footer,
  onSubmit,
  onCancel,
}: FormModalProps) {
  const handleCancel = () => {
    if (onCancel) {
      onCancel()
    } else {
      onOpenChange(false)
    }
  }

  // Use provided style or default (tenant color will be set by parent if needed)
  const defaultSubmitStyle = submitButtonStyle || {}

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={contentClassName}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-6">
          {children}

          {error && <p className="text-sm text-red-500">{error}</p>}

          {footer || (
            <div className="flex justify-end gap-4">
              {showCancel && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCancel}
                  disabled={isLoading}
                >
                  {cancelLabel}
                </Button>
              )}
              <Button
                type="submit"
                style={defaultSubmitStyle}
                className={submitButtonClassName}
                disabled={isLoading}
              >
                {isLoading ? loadingLabel : submitLabel}
              </Button>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}

