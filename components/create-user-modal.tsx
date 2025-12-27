"use client"

import type React from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
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
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { tenant } = useTenant()

  const resetForm = () => {
    setEmail("")
    setPassword("")
    setFullName("")
    setPhone("")
    setDepartment("")
    setCurrentPosition("")
    setRole("user")
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
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
    if (!newOpen) {
      resetForm()
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create new user</DialogTitle>
          <DialogDescription>Add a new user to your organization</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
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

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
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

