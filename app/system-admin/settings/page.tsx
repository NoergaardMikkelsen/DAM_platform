"use client"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import { Save, Shield, Mail, Database, Globe, Key } from "lucide-react"

interface SystemSettings {
  platform_name: string
  platform_description: string
  allow_registration: boolean
  require_email_verification: boolean
  session_timeout_hours: number
  password_min_length: number
  max_file_size_mb: number
  max_storage_per_client_gb: number
  smtp_host: string
  smtp_port: number
  smtp_user: string
  smtp_password: string
  smtp_from_email: string
  maintenance_mode: boolean
}

export default function SystemSettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>({
    platform_name: "BrandAssets",
    platform_description: "Professional Digital Asset Management Platform",
    allow_registration: true,
    require_email_verification: true,
    session_timeout_hours: 24,
    password_min_length: 8,
    max_file_size_mb: 100,
    max_storage_per_client_gb: 10,
    smtp_host: "",
    smtp_port: 587,
    smtp_user: "",
    smtp_password: "",
    smtp_from_email: "",
    maintenance_mode: false
  })

  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      // Load settings from system_settings table
      const { data, error } = await supabase
        .from("system_settings")
        .select("*")
        .single()

      if (data && !error) {
        setSettings(prev => ({
          ...prev,
          ...data
        }))
      }
    } catch (error) {
      console.error("Error loading settings:", error)
    }
  }

  const saveSettings = async (section: string) => {
    setIsLoading(true)
    try {
      const { error } = await supabase
        .from("system_settings")
        .upsert(settings, { onConflict: 'id' })

      if (error) throw error

      toast({
        title: "Settings saved",
        description: `${section} settings have been updated successfully.`,
      })
    } catch (error) {
      console.error("Error saving settings:", error)
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const updateSetting = (key: keyof SystemSettings, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }))
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
        <p className="text-gray-600 mt-1">Configure global platform settings and preferences</p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="storage" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Storage
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Integrations
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                General Settings
              </CardTitle>
              <CardDescription>
                Configure basic platform information and user registration settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="platform_name">Platform Name</Label>
                  <Input
                    id="platform_name"
                    value={settings.platform_name}
                    onChange={(e) => updateSetting('platform_name', e.target.value)}
                    placeholder="BrandAssets"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="platform_description">Platform Description</Label>
                  <Input
                    id="platform_description"
                    value={settings.platform_description}
                    onChange={(e) => updateSetting('platform_description', e.target.value)}
                    placeholder="Professional Digital Asset Management Platform"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Allow User Registration</Label>
                    <p className="text-sm text-gray-600">
                      Allow new users to register accounts on the platform
                    </p>
                  </div>
                  <Switch
                    checked={settings.allow_registration}
                    onCheckedChange={(checked) => updateSetting('allow_registration', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Require Email Verification</Label>
                    <p className="text-sm text-gray-600">
                      Require users to verify their email address before accessing the platform
                    </p>
                  </div>
                  <Switch
                    checked={settings.require_email_verification}
                    onCheckedChange={(checked) => updateSetting('require_email_verification', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Maintenance Mode</Label>
                    <p className="text-sm text-gray-600">
                      Put the platform in maintenance mode, restricting access to administrators only
                    </p>
                  </div>
                  <Switch
                    checked={settings.maintenance_mode}
                    onCheckedChange={(checked) => updateSetting('maintenance_mode', checked)}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => saveSettings("General")} disabled={isLoading}>
                  <Save className="h-4 w-4 mr-2" />
                  Save General Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Settings
              </CardTitle>
              <CardDescription>
                Configure password policies and session management
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="session_timeout">Session Timeout (hours)</Label>
                  <Input
                    id="session_timeout"
                    type="number"
                    value={settings.session_timeout_hours}
                    onChange={(e) => updateSetting('session_timeout_hours', parseInt(e.target.value))}
                    min="1"
                    max="168"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password_min_length">Minimum Password Length</Label>
                  <Input
                    id="password_min_length"
                    type="number"
                    value={settings.password_min_length}
                    onChange={(e) => updateSetting('password_min_length', parseInt(e.target.value))}
                    min="6"
                    max="50"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-900">Password Requirements</h4>
                <p className="text-sm text-gray-600">
                  Configure additional password requirements such as complexity rules, special characters, etc.
                </p>
                {/* Placeholder for additional password settings */}
                <div className="text-sm text-gray-500 p-4 bg-gray-50 rounded-lg">
                  Additional password policies coming soon...
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => saveSettings("Security")} disabled={isLoading}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Security Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Storage Settings */}
        <TabsContent value="storage">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Storage Settings
              </CardTitle>
              <CardDescription>
                Configure file upload limits and storage quotas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="max_file_size">Maximum File Size (MB)</Label>
                  <Input
                    id="max_file_size"
                    type="number"
                    value={settings.max_file_size_mb}
                    onChange={(e) => updateSetting('max_file_size_mb', parseInt(e.target.value))}
                    min="1"
                    max="1000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_storage_per_client">Storage Limit per Client (GB)</Label>
                  <Input
                    id="max_storage_per_client"
                    type="number"
                    value={settings.max_storage_per_client_gb}
                    onChange={(e) => updateSetting('max_storage_per_client_gb', parseInt(e.target.value))}
                    min="1"
                    max="1000"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-900">Storage Management</h4>
                <p className="text-sm text-gray-600">
                  Monitor storage usage and configure automatic cleanup policies
                </p>
                <div className="text-sm text-gray-500 p-4 bg-gray-50 rounded-lg">
                  Storage analytics and cleanup policies coming soon...
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => saveSettings("Storage")} disabled={isLoading}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Storage Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Settings */}
        <TabsContent value="email">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Settings
              </CardTitle>
              <CardDescription>
                Configure SMTP settings for email notifications and user communications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="smtp_host">SMTP Host</Label>
                  <Input
                    id="smtp_host"
                    value={settings.smtp_host}
                    onChange={(e) => updateSetting('smtp_host', e.target.value)}
                    placeholder="smtp.gmail.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtp_port">SMTP Port</Label>
                  <Input
                    id="smtp_port"
                    type="number"
                    value={settings.smtp_port}
                    onChange={(e) => updateSetting('smtp_port', parseInt(e.target.value))}
                    placeholder="587"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtp_user">SMTP Username</Label>
                  <Input
                    id="smtp_user"
                    value={settings.smtp_user}
                    onChange={(e) => updateSetting('smtp_user', e.target.value)}
                    placeholder="your-email@gmail.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtp_from_email">From Email Address</Label>
                  <Input
                    id="smtp_from_email"
                    value={settings.smtp_from_email}
                    onChange={(e) => updateSetting('smtp_from_email', e.target.value)}
                    placeholder="noreply@brandassets.space"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtp_password">SMTP Password / App Password</Label>
                <Input
                  id="smtp_password"
                  type="password"
                  value={settings.smtp_password}
                  onChange={(e) => updateSetting('smtp_password', e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-900">Email Templates</h4>
                <p className="text-sm text-gray-600">
                  Configure email templates for notifications, welcome messages, and password resets
                </p>
                <div className="text-sm text-gray-500 p-4 bg-gray-50 rounded-lg">
                  Email template customization coming soon...
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => saveSettings("Email")} disabled={isLoading}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Email Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations Settings */}
        <TabsContent value="integrations">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Integrations & API
              </CardTitle>
              <CardDescription>
                Configure third-party integrations and API access
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-900">API Keys</h4>
                <p className="text-sm text-gray-600">
                  Generate and manage API keys for programmatic access to the platform
                </p>
                <div className="text-sm text-gray-500 p-4 bg-gray-50 rounded-lg">
                  API key management coming soon...
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-900">Webhooks</h4>
                <p className="text-sm text-gray-600">
                  Configure webhooks for real-time notifications and integrations
                </p>
                <div className="text-sm text-gray-500 p-4 bg-gray-50 rounded-lg">
                  Webhook configuration coming soon...
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-900">Third-party Services</h4>
                <p className="text-sm text-gray-600">
                  Connect with external services for enhanced functionality
                </p>
                <div className="text-sm text-gray-500 p-4 bg-gray-50 rounded-lg">
                  Integration marketplace coming soon...
          </div>
        </div>

              <div className="flex justify-end">
                <Button onClick={() => saveSettings("Integrations")} disabled={isLoading}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Integration Settings
                </Button>
      </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

