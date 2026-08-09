import { createClient } from '@airostack/client'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Auth helpers
export const signIn = async (email, password) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, email, phone, country, city, address, created_at')
      .eq('email', email)
      .single()

    if (error) {
      return { user: null, error: { message: 'Invalid email or password' } }
    }

    // Verify password by checking against users table
    const { data: userData, error: passError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .eq('password', password)
      .single()

    if (passError || !userData) {
      return { user: null, error: { message: 'Invalid email or password' } }
    }

    // Return user data without password
    return { user: data, error: null }
  } catch {
    return { user: null, error: { message: 'An error occurred during login' } }
  }
}

export const signOut = () => {
  // Clear cookies/session
  if (typeof window !== 'undefined') {
    document.cookie = 'auth-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
  }
}

export const getCurrentUser = () => {
  // Implement session management
  if (typeof window !== 'undefined') {
    const userStr = localStorage.getItem('seller_user')
    return userStr ? JSON.parse(userStr) : null
  }
  return null
}