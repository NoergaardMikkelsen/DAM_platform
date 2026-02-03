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
import type { TagDimension } from "@/lib/types/database"
import { createTag } from "@/lib/utils/tag-creation"
import { SORT_ORDER_OPTIONS } from "@/lib/utils/sorting"

interface CreateTagModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

const steps = [
  { id: 1, label: "Tag information" },
  { id: 2, label: "Optional settings" },
]

export function CreateTagModal({ open, onOpenChange, onSuccess }: CreateTagModalProps) {
  const [label, setLabel] = useState("")
  const [dimensionKey, setDimensionKey] = useState("")
  const [sortOrder, setSortOrder] = useState("Normal")
  const [dimensions, setDimensions] = useState<TagDimension[]>([])
  const [currentStep, setCurrentStep] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ label?: string; dimensionKey?: string }>({})
  const [isLoading, setIsLoading] = useState(false)
  const { tenant } = useTenant()
  const supabase = createClient()

  useEffect(() => {
    if (open) {
      loadDimensions()
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      // Reset form when modal closes
      setCurrentStep(1)
      setLabel("")
      setDimensionKey("")
      setSortOrder("Normal")
      setError(null)
      setFieldErrors({})
    }
  }, [open])

  const loadDimensions = async () => {
    const { data } = await supabase
      .from("tag_dimensions")
      .select("dimension_key, label, allow_user_creation, is_hierarchical")
      .eq("allow_user_creation", true)
      .order("display_order")

    setDimensions(data || [])
  }

  const validateStep = (step: number): boolean => {
    if (step === 1) {
      // Step 1: Tag information - Label and dimension are required
      return label.trim().length > 0 && dimensionKey.length > 0
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
      setFieldErrors({})
    } else {
      if (currentStep === 1) {
        const errors: { label?: string; dimensionKey?: string } = {}
        if (label.trim().length === 0) {
          errors.label = "Tag label is required"
        }
        if (dimensionKey.length === 0) {
          errors.dimensionKey = "Please select a dimension"
        }
        setFieldErrors(errors)
        
        // Create a more specific error message
        const missingFields: string[] = []
        if (label.trim().length === 0) missingFields.push("tag label")
        if (dimensionKey.length === 0) missingFields.push("dimension")
        
        setError(`Please fill in all required fields: ${missingFields.join(" and ")}`)
      }
    }
  }

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1))
    setError(null)
    setFieldErrors({})
  }

  const handleSubmit = async () => {
    if (!validateStep(1)) {
      setError("Please complete all required fields")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      if (!dimensionKey) {
        throw new Error("Please select a dimension")
      }

      const selectedDimension = dimensions.find(d => d.dimension_key === dimensionKey)
      if (!selectedDimension) {
        throw new Error("Invalid dimension selected")
      }

      // Use consolidated tag creation utility
      const tagId = await createTag(supabase, {
        label,
        dimensionKey,
        clientId: tenant.id,
        userId: user.id,
        dimension: selectedDimension,
        sortOrder: SORT_ORDER_OPTIONS.find(opt => opt.label === sortOrder)?.value ?? 0,
      })

      if (!tagId) {
        throw new Error("Failed to create tag")
      }

      // Reset form and close modal
      setCurrentStep(1)
      setLabel("")
      setDimensionKey("")
      setSortOrder("Normal")
      onOpenChange(false)
      onSuccess?.()
    } catch (error: any) {
      setError(error.message || "Failed to create tag")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col p-0">
        <div className="px-6 pt-6 flex-shrink-0">
          <DialogHeader>
            <DialogTitle>Create new tag</DialogTitle>
            <DialogDescription className="sr-only">Add a new tag to organize your assets</DialogDescription>
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
                      onChange={(e) => {
                        setLabel(e.target.value)
                        if (fieldErrors.label) {
                          setFieldErrors(prev => ({ ...prev, label: undefined }))
                        }
                        if (error && label.trim().length > 0 && dimensionKey.length > 0) {
                          setError(null)
                        }
                      }}
                      placeholder="e.g., Campaign, Employee, Product"
                      className={fieldErrors.label ? "border-red-500 focus-visible:ring-red-500" : ""}
                    />
                    {fieldErrors.label && (
                      <p className="text-xs text-red-600">{fieldErrors.label}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dimensionKey">Dimension *</Label>
                    <Select 
                      value={dimensionKey} 
                      onValueChange={(value) => {
                        setDimensionKey(value)
                        if (fieldErrors.dimensionKey) {
                          setFieldErrors(prev => ({ ...prev, dimensionKey: undefined }))
                        }
                        if (error && label.trim().length > 0 && value.length > 0) {
                          setError(null)
                        }
                      }} 
                      required
                    >
                      <SelectTrigger className={fieldErrors.dimensionKey ? "border-red-500 focus:ring-red-500" : ""}>
                        <SelectValue placeholder="Select dimension" />
                      </SelectTrigger>
                      <SelectContent>
                        {dimensions.map((dim) => (
                          <SelectItem key={dim.dimension_key} value={dim.dimension_key}>
                            {dim.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldErrors.dimensionKey ? (
                      <p className="text-xs text-red-600">{fieldErrors.dimensionKey}</p>
                    ) : (
                      <p className="text-xs text-gray-500">
                        Select which dimension this tag belongs to. Tags are organized by dimensions.
                      </p>
                    )}
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
              <p className="text-sm font-medium">{error}</p>
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
              {isLoading ? "Creating..." : (
                <>
                  Create tag
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
