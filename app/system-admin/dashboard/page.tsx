export default function SystemAdminDashboard() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">System Overview</h1>

      {/* System stats - no client data */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Total Clients</h3>
          <p className="text-3xl font-bold text-blue-600 mt-2">--</p>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Active Clients</h3>
          <p className="text-3xl font-bold text-green-600 mt-2">--</p>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">System Users</h3>
          <p className="text-3xl font-bold text-purple-600 mt-2">--</p>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Total Storage</h3>
          <p className="text-3xl font-bold text-orange-600 mt-2">-- GB</p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a href="/system-admin/clients/create">
            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium">
              Create Client
            </button>
          </a>

          <button className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium">
            Add System User
          </button>

          <button className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium">
            System Settings
          </button>
        </div>
      </div>
    </div>
  )
}
