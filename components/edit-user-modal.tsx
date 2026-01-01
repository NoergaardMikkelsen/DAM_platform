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

interface EditUserModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  userId: string
  initialData: {
    full_name: string
    email: string
    phone?: string | null
    department?: string | null
    current_position?: string | null
    role?: string
  }
}

const steps = [
  { id: 1, label: "User information" },
  { id: 2, label: "User login" },
  { id: 3, label: "User role" },
]

export function EditUserModal({ open, onOpenChange, onSuccess, userId, initialData }: EditUserModalProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [department, setDepartment] = useState("")
  const [currentPosition, setCurrentPosition] = useState("")
  const [role, setRole] = useState("user")
  const [currentStep, setCurrentStep] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { tenant } = useTenant()

  // Load initial data when modal opens
  useEffect(() => {
    if (open && initialData) {
      setFullName(initialData.full_name || "")
      setEmail(initialData.email || "")
      setPhone(initialData.phone || "")
      setDepartment(initialData.department || "")
      setCurrentPosition(initialData.current_position || "")
      setRole(initialData.role || "user")
      setPassword("") // Don't pre-fill password
      setCurrentStep(1)
      setError(null)
    }
  }, [open, initialData])

  const validateStep = (step: number): boolean => {
    if (step === 1) {
      // Step 1: User information - Full name is required
      return fullName.trim().length > 0
    }
    if (step === 2) {
      // Step 2: User login - Email is required, password is optional for edit
      return email.trim().length > 0
    }
    if (step === 3) {
      // Step 3: User role - Role is required
      return role.length > 0
    }
    return true
  }

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, steps.length))
      setError(null)
    } else {
      if (currentStep === 1) {
        setError("Please enter full name")
      } else if (currentStep === 2) {
        setError("Please enter email")
      } else if (currentStep === 3) {
        setError("Please select a role")
      }
    }
  }

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1))
    setError(null)
  }

  const handleSubmit = async () => {
    if (!validateStep(3)) {
      setError("Please complete all required fields")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      // Update user profile
      const updateData: any = {
        full_name: fullName,
        phone: phone || null,
        department: department || null,
        current_position: currentPosition || null,
      }

      const { error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', userId)

      if (updateError) throw updateError

      // Update email if changed (requires API route with service role)
      if (email !== initialData.email) {
        const response = await fetch('/api/users/update-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, email })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Could not update email")
        }
      }

      // Update password if provided (requires API route with service role)
      if (password.trim().length > 0) {
        const response = await fetch('/api/users/update-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, password })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Could not update password")
        }
      }

      // Update role if changed
      if (role !== initialData.role) {
        const { data: roleData, error: roleError } = await supabase
          .from('roles')
          .select('id')
          .eq('key', role)
          .single()

        if (roleError) throw roleError

        const { error: clientUserError } = await supabase
          .from('client_users')
          .update({ role_id: roleData.id })
          .eq('user_id', userId)
          .eq('client_id', tenant.id)

        if (clientUserError) throw clientUserError
      }

      // Reset form and close modal
      setCurrentStep(1)
      setPassword("")
      onOpenChange(false)
      onSuccess?.()
    } catch (error: any) {
      setError(error.message || "Failed to update user")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col p-0">
        <div className="px-6 pt-6 flex-shrink-0">
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription className="sr-only">Update user information</DialogDescription>
          </DialogHeader>

          {/* Progress Indicator */}
          <div className="mb-8 pt-6">
            <Stepper
              steps={steps.map((s, i) => ({ label: s.label }))}
              activeStep={currentStep - 1}
              styleConfig={{
                activeBgColor: tenant.primary_color || '#E55C6A',
                activeTextColor: '#ffffff',
                inactiveBgColor: '#D9D9D9',
                inactiveTextColor: '#000000',
                completedBgColor: tenant.primary_color || '#E55C6A',
                completedTextColor: '#ffffff',
                size: '40px',
                circleFontSize: '14px',
                labelFontSize: '12px',
                borderRadius: '50%',
                fontWeight: '500',
              }}
              connectorStyleConfig={{
                disabledColor: '#D9D9D9',
                activeColor: tenant.primary_color || '#E55C6A',
                completedColor: tenant.primary_color || '#E55C6A',
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
            {/* Step 1: User Information */}
            {currentStep === 1 && (
              <div className="space-y-6 flex-1">
                <h3 className="text-lg font-semibold text-gray-900">User information</h3>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full name *</Label>
                    <Input
                      id="fullName"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="John Doe"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+45 12 34 56 78"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <Input
                      id="department"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="Marketing"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: User Login */}
            {currentStep === 2 && (
              <div className="space-y-6 flex-1">
                <h3 className="text-lg font-semibold text-gray-900">User login</h3>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="john@example.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Leave empty to keep current password"
                    />
                    <p className="text-xs text-gray-500">
                      Leave empty to keep the current password
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: User Role */}
            {currentStep === 3 && (
              <div className="space-y-6 flex-1">
                <h3 className="text-lg font-semibold text-gray-900">User role</h3>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="role">Choose role for user *</Label>
                    <Select value={role} onValueChange={setRole} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="currentPosition">Current position</Label>
                    <Input
                      id="currentPosition"
                      value={currentPosition}
                      onChange={(e) => setCurrentPosition(e.target.value)}
                      placeholder="Marketing Manager"
                    />
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
                  Update user
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

