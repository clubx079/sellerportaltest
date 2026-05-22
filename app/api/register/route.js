import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    const body = await request.json()
    const {
      token,
      phone,
      property_address,
      contact_person_name,
      email,
      password,
      business_name,
      description
    } = body

    // Validate required fields
    if (!token || !contact_person_name || !email || !password || !phone) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields'
      }, { status: 400 })
    }

    // Validate magic link token directly from Supabase
    const { data: tokenRecord, error: tokenError } = await supabase
      .from('magic_link_tokens')
      .select('*')
      .eq('token', token)
      .single()

    if (tokenError || !tokenRecord) {
      return NextResponse.json({
        success: false,
        error: 'Invalid or expired registration token'
      }, { status: 400 })
    }

    // Check if token is already used
    if (tokenRecord.used) {
      return NextResponse.json({
        success: false,
        error: 'This registration link has already been used'
      }, { status: 400 })
    }

    // Check if token is expired
    const now = new Date()
    const expiresAt = new Date(tokenRecord.expires_at)
    if (now > expiresAt) {
      return NextResponse.json({
        success: false,
        error: 'This registration link has expired'
      }, { status: 400 })
    }

    // Check if email already exists
    const { data: existingUser } = await supabase
      .from('seller_applications')
      .select('id')
      .eq('email', email)
      .single()

    if (existingUser) {
      return NextResponse.json({
        success: false,
        error: 'An account with this email already exists'
      }, { status: 400 })
    }

    // Check if phone already exists
    const { data: existingPhone } = await supabase
      .from('seller_applications')
      .select('id')
      .eq('phone', phone)
      .single()

    if (existingPhone) {
      return NextResponse.json({
        success: false,
        error: 'An account with this phone number already exists'
      }, { status: 400 })
    }

    // Create seller application (auto-approved for magic link registrations)
    const { data: newSeller, error: insertError } = await supabase
      .from('seller_applications')
      .insert([{
        contact_person_name,
        email,
        phone,
        password, // In production, hash this!
        business_name: business_name || 'Individual Seller',
        description: description || '',
        business_type: 'individual',
        deals_per_month: 'not_specified',
        primary_markets: property_address || '',
        property_types: ['residential'],
        status: 'onboarding',
        temp_seller_id: tokenRecord.temp_seller_id, // Link to temp seller
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (insertError) {
      console.error('Error creating seller application:', insertError)
      return NextResponse.json({
        success: false,
        error: 'Failed to create seller application'
      }, { status: 500 })
    }

    // Return success with user data (without password)
    return NextResponse.json({
      success: true,
      user: {
        id: newSeller.id,
        contact_person_name: newSeller.contact_person_name,
        email: newSeller.email,
        phone: newSeller.phone,
        business_name: newSeller.business_name,
        status: newSeller.status
      },
      message: 'Registration successful! Your account is now active.'
    })

  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
