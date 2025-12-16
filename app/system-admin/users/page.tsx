export default function SystemUsersPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">System Users</h1>
        <p className="text-gray-600 mt-1">Manage system-wide user accounts and permissions</p>
      </div>

      {/* Coming Soon Placeholder */}
      <div className="rounded-lg border bg-white p-12 text-center">
        <div className="mx-auto max-w-md">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">System User Management</h2>
          <p className="text-gray-600 mb-6">
            Comprehensive user administration for the entire platform is coming soon.
            This will include managing system administrators, user permissions, and access controls.
          </p>
          <div className="text-sm text-gray-500">
            Features planned:
            <ul className="mt-2 space-y-1 text-left">
              <li>• System administrator management</li>
              <li>• Cross-client user permissions</li>
              <li>• User activity monitoring</li>
              <li>• Security and access controls</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

