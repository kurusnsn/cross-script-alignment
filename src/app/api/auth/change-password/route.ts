import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth"
import { DEV_MOCK_AUTH_ENABLED, DEV_MOCK_USER } from "@/lib/devAuth"

export async function PATCH(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) return unauthorizedResponse()

  if (DEV_MOCK_AUTH_ENABLED && user.email === DEV_MOCK_USER.email) {
    return NextResponse.json(
      { error: "Password change is unavailable for the development mock account." },
      { status: 400 }
    )
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "Password changes are unavailable in this environment." },
      { status: 500 }
    )
  }

  let body: {
    currentPassword?: string
    newPassword?: string
    confirmPassword?: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const currentPassword = String(body.currentPassword || "")
  const newPassword = String(body.newPassword || "")
  const confirmPassword = String(body.confirmPassword || "")

  if (!currentPassword || !newPassword || !confirmPassword) {
    return NextResponse.json(
      { error: "currentPassword, newPassword, and confirmPassword are required." },
      { status: 400 }
    )
  }

  if (newPassword.length < 6) {
    return NextResponse.json(
      { error: "New password must be at least 6 characters." },
      { status: 400 }
    )
  }

  if (newPassword !== confirmPassword) {
    return NextResponse.json(
      { error: "New password and confirmation do not match." },
      { status: 400 }
    )
  }

  if (!user.email) {
    return NextResponse.json(
      { error: "No email found for the authenticated account." },
      { status: 400 }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  })

  if (signInError || !signInData.session) {
    return NextResponse.json(
      { error: "Current password is incorrect." },
      { status: 400 }
    )
  }

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: signInData.session.access_token,
    refresh_token: signInData.session.refresh_token,
  })

  if (sessionError) {
    return NextResponse.json(
      { error: "Failed to validate account session for password update." },
      { status: 500 }
    )
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  })

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message || "Failed to update password." },
      { status: 400 }
    )
  }

  return NextResponse.json({ success: true })
}
