export default function SystemSettingsPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
        <p className="text-gray-600 mt-1">Configure global platform settings and preferences</p>
      </div>

      {/* Coming Soon Placeholder */}
      <div className="rounded-lg border bg-white p-12 text-center">
        <div className="mx-auto max-w-md">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">System Configuration</h2>
          <p className="text-gray-600 mb-6">
            Advanced system settings and configuration options are coming soon.
            This will include platform-wide settings, integrations, and administrative controls.
          </p>
          <div className="text-sm text-gray-500">
            Features planned:
            <ul className="mt-2 space-y-1 text-left">
              <li>• Platform-wide configuration</li>
              <li>• Integration settings</li>
              <li>• Security policies</li>
              <li>• Backup and maintenance</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

