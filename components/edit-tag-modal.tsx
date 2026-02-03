"use client"

import type React from "react"
import { createClient } from "@/lib/supabase/client"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Stepper } from "react-form-stepper"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { useState, useEffect } from "react"
import { useTenant } from "@/lib/context/tenant-context"
import { generateSlug } from "@/lib/utils/slug"
import { SORT_ORDER_OPTIONS, getSortOrderLabel } from "@/lib/utils/sorting"

interface EditTagModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  tagId: string
  initialData: {
    label: string
    dimension_key: string | null
    sort_order: number
  }
}

const steps = [
  { id: 1, label: "Tag information" },
  { id: 2, label: "Optional settings" },
]

export function EditTagModal({ open, onOpenChange, onSuccess, tagId, initialData }: EditTagModalProps) {
  const [label, setLabel] = useState("")
  const [dimensionKey, setDimensionKey] = useState("")
  const [sortOrder, setSortOrder] = useState("Normal")
  const [currentStep, setCurrentStep] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { tenant } = useTenant()
  const supabase = createClient()

  // Load initial data when modal opens
  useEffect(() => {
    if (open && initialData) {
      setLabel(initialData.label || "")
      setDimensionKey(initialData.dimension_key || "")
      setSortOrder(getSortOrderLabel(initialData.sort_order ?? 0))
      setCurrentStep(1)
      setError(null)
    }
  }, [open, initialData])

  const validateStep = (step: number): boolean => {
    if (step === 1) {
      // Step 1: Tag information - Label is required
      return label.trim().length > 0
    }
    if (step === 2) {
      // Step 2: Optional settings - Always valid (all fields optional)
      return true
    }
    return true
  }

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, steps.length))
      setError(null)
    } else {
      if (currentStep === 1) {
        setError("Please enter tag label")
      }
    }
  }

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1))
    setError(null)
  }

  const handleSubmit = async () => {
    if (!validateStep(1)) {
      setError("Please complete all required fields")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Generate new slug if label changed
      const newSlug = label !== initialData.label
        ? generateSlug(label.trim())
        : undefined // Keep existing slug if label hasn't changed

      const updateData: any = {
        label: label.trim(),
        sort_order: SORT_ORDER_OPTIONS.find(opt => opt.label === sortOrder)?.value ?? 0,
      }

      // Only update slug if label changed
      if (newSlug) {
        // Check if slug already exists (excluding current tag)
        const { data: existing } = await supabase
          .from("tags")
          .select("id")
          .eq("slug", newSlug)
          .or(`client_id.eq.${tenant.id},client_id.is.null`)
          .neq("id", tagId)
          .maybeSingle()

        if (existing) {
          throw new Error("A tag with this name already exists")
        }

        updateData.slug = newSlug
      }

      // Update tag
      const { error: updateError } = await supabase
        .from("tags")
        .update(updateData)
        .eq("id", tagId)

      if (updateError) {
        if (updateError.code === "42501" || updateError.message?.includes("permission")) {
          throw new Error("You don't have permission to edit this tag.")
        }
        throw updateError
      }

      // Reset form and close modal
      setCurrentStep(1)
      onOpenChange(false)
      onSuccess?.()
    } catch (error: any) {
      setError(error.message || "Failed to update tag")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col p-0">
        <div className="px-6 pt-6 flex-shrink-0">
          <DialogHeader>
            <DialogTitle>Edit tag</DialogTitle>
            <DialogDescription className="sr-only">Update tag information</DialogDescription>
          </DialogHeader>

          {/* Progress Indicator */}
          <div className="mb-8 pt-6">
            <Stepper
              steps={steps.map((s, i) => ({ label: s.label }))}
              activeStep={currentStep - 1}
              styleConfig={{
                activeBgColor: tenant.primary_color || '#000000',
                activeTextColor: '#ffffff',
                inactiveBgColor: '#D9D9D9',
                inactiveTextColor: '#000000',
                completedBgColor: tenant.primary_color || '#000000',
                completedTextColor: '#ffffff',
                size: '40px',
                circleFontSize: '14px',
                labelFontSize: '12px',
                borderRadius: '50%',
                fontWeight: '500',
              }}
              connectorStyleConfig={{
                disabledColor: '#D9D9D9',
                activeColor: tenant.primary_color || '#000000',
                completedColor: tenant.primary_color || '#000000',
                size: 1,
                stepSize: '40px',
                style: 'solid',
              }}
            />
          </div>
        </div>

        {/* Step Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 min-h-0">
          <div className="min-h-[400px] flex flex-col">
            {/* Step 1: Tag Information */}
            {currentStep === 1 && (
              <div className="space-y-6 flex-1">
                <h3 className="text-lg font-semibold text-gray-900">Tag information</h3>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="label">Tag label *</Label>
                    <Input
                      id="label"
                      required
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      placeholder="e.g., Campaign, Employee, Product"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dimensionKey">Dimension</Label>
                    <Input
                      id="dimensionKey"
                      value={dimensionKey || "N/A"}
                      disabled
                      className="bg-gray-50"
                    />
                    <p className="text-xs text-gray-500">
                      Dimension cannot be changed after tag creation.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Optional Settings */}
            {currentStep === 2 && (
              <div className="space-y-6 flex-1">
                <h3 className="text-lg font-semibold text-gray-900">Optional settings</h3>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="sortOrder">Display priority</Label>
                    <Select value={sortOrder} onValueChange={setSortOrder}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        {SORT_ORDER_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.label}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">
                      Choose how prominently this tag should appear when sorting. Higher priority tags appear first.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-red-800 border border-red-200">
              <p className="text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Navigation Buttons - Fixed at bottom */}
        <div className="flex justify-center items-center gap-4 px-6 py-4 border-t bg-white flex-shrink-0">
          <Button
            type="button"
            variant="secondary"
            onClick={currentStep === 1 ? () => onOpenChange(false) : handlePrevious}
            disabled={isLoading}
          >
            {currentStep === 1 ? (
              "Cancel"
            ) : (
              <>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Previous
              </>
            )}
          </Button>

          {currentStep < steps.length ? (
            <Button
              type="button"
              onClick={handleNext}
              disabled={isLoading}
              style={{ backgroundColor: tenant.primary_color }}
            >
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading}
              style={{ backgroundColor: tenant.primary_color }}
            >
              {isLoading ? "Updating..." : (
                <>
                  Update tag
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

