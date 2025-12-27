"use client"

import type React from "react"
import { createClient } from "@/lib/supabase/client"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FormModal } from "@/components/form-modal"
import { useFormModal } from "@/hooks/use-form-modal"
import { useState } from "react"
import { useTenant } from "@/lib/context/tenant-context"

interface CreateUserModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function CreateUserModal({ open, onOpenChange, onSuccess }: CreateUserModalProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [department, setDepartment] = useState("")
  const [currentPosition, setCurrentPosition] = useState("")
  const [role, setRole] = useState("user")
  const { tenant } = useTenant()

  const resetForm = () => {
    setEmail("")
    setPassword("")
    setFullName("")
    setPhone("")
    setDepartment("")
    setCurrentPosition("")
    setRole("user")
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
      const supabase = createClient()

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone,
            department,
            current_position: currentPosition,
          },
        },
      })

      if (authError) throw authError

      if (authData.user) {
        const { data: roleData, error: roleError } = await supabase
          .from('roles')
          .select('id')
          .eq('key', role)
          .single()

        if (roleError) throw roleError

        const { error: clientUserError } = await supabase
          .from('client_users')
          .insert({
            user_id: authData.user.id,
            client_id: tenant.id,
            role_id: roleData.id,
            status: 'active'
          })

        if (clientUserError) throw clientUserError
      }
    })
  }

  return (
    <FormModal
      open={open}
      onOpenChange={(newOpen) => handleOpenChange(newOpen, onOpenChange)}
      title="Create new user"
      description="Add a new user to your organization"
      error={error}
      isLoading={isLoading}
      submitLabel="Create user"
      loadingLabel="Creating..."
      submitButtonStyle={{ backgroundColor: tenant.primary_color }}
      onSubmit={onSubmit}
    >
      <div className="grid gap-6 md:grid-cols-2">
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
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="password">Password *</Label>
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
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
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="department">Department</Label>
          <Input
            id="department"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="Marketing"
          />
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

      <div className="space-y-2">
        <Label htmlFor="role">Role *</Label>
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
    </FormModal>
  )
}

