import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { userId, email, password } = body

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      )
    }

    if (!email && !password) {
      return NextResponse.json(
        { error: "Email or password is required" },
        { status: 400 }
      )
    }

    // Check if current user is admin/superadmin
    const supabase = await createClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    
    if (!currentUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Verify user has admin access
    // Check if user is superadmin
    const { data: superadminCheck } = await supabase
      .from('system_admins')
      .select('id')
      .eq('id', currentUser.id)
      .maybeSingle()

    // Check if user is admin/superadmin in any tenant
    const { data: clientUser } = await supabase
      .from('client_users')
      .select(`
        roles!inner(key)
      `)
      .eq('user_id', currentUser.id)
      .eq('status', 'active')
      .limit(1)

    const isSuperadmin = !!superadminCheck
    const isAdmin = clientUser && clientUser.some((cu: any) => cu.roles.key === 'admin' || cu.roles.key === 'superadmin')

    if (!isSuperadmin && !isAdmin) {
      return NextResponse.json(
        { error: "Unauthorized - Admin access required" },
        { status: 403 }
      )
    }

    // Verify that the user being edited belongs to a tenant the current user has access to
    if (!isSuperadmin) {
      const { data: targetUserClient } = await supabase
        .from('client_users')
        .select('client_id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .limit(1)

      if (!targetUserClient || targetUserClient.length === 0) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        )
      }

      // Check if current user has access to the same tenant
      const { data: hasAccess } = await supabase
        .from('client_users')
        .select('id')
        .eq('user_id', currentUser.id)
        .eq('client_id', targetUserClient[0].client_id)
        .eq('status', 'active')
        .maybeSingle()

      if (!hasAccess) {
        return NextResponse.json(
          { error: "Unauthorized - No access to user's tenant" },
          { status: 403 }
        )
      }
    }

    // Use service role client for admin operations
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Service role key not configured" },
        { status: 500 }
      )
    }

    const adminClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    )

    // Update user auth data
    const updateData: any = {}
    if (email) updateData.email = email
    if (password) updateData.password = password

    const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, updateData)

    if (updateError) {
      console.error("Error updating user auth:", updateError)
      return NextResponse.json(
        { error: updateError.message || "Failed to update user authentication" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error updating user auth:", error)
    return NextResponse.json(
      { error: error.message || "Failed to update user authentication" },
      { status: 500 }
    )
  }
}

