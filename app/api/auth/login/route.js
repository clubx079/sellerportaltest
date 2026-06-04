import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyPassword, hashPassword, isHashed } from '@/lib/password';

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

const STATUS_ERRORS = {
  pending: 'Your application is pending review. Please wait for approval.',
  under_review: 'Your application is under review. We will notify you once approved.',
  on_hold: 'Your application is on hold. Please contact support for more information.',
  requires_info: 'Your application requires additional information. Please check your email.',
  rejected: 'Your application has been rejected. Please contact support for more information.',
  suspended: 'Your account has been suspended. Please contact support for more information.',
  blocked: 'Your account has been blocked. Please contact support for more information.',
};

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }
    const supabase = getSupabase();
    const { data: application, error } = await supabase
      .from('seller_applications')
      .select('*')
      .eq('email', String(email).trim().toLowerCase())
      .maybeSingle();

    if (error || !application) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const ok = await verifyPassword(password, application.password);
    if (!ok) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Lazy migration: if the stored password was still plaintext, hash it now.
    if (!isHashed(application.password)) {
      try {
        const hashed = await hashPassword(password);
        await supabase.from('seller_applications').update({ password: hashed }).eq('id', application.id);
      } catch {}
    }

    if (STATUS_ERRORS[application.status]) {
      return NextResponse.json({ error: STATUS_ERRORS[application.status] }, { status: 403 });
    }
    if (!['approved', 'onboarding'].includes(application.status)) {
      return NextResponse.json({ error: 'Your application status does not allow login. Please contact support.' }, { status: 403 });
    }

    const { data: planRow } = await supabase
      .from('seller_plans').select('plan_type').eq('seller_id', application.id).maybeSingle();

    return NextResponse.json({
      user: {
        id: application.id,
        email: application.email,
        businessName: application.business_name,
        contactPersonName: application.contact_person_name,
        phone: application.phone,
        businessType: application.business_type,
        plan: planRow?.plan_type || null,
      },
    });
  } catch {
    return NextResponse.json({ error: 'An error occurred. Please try again.' }, { status: 500 });
  }
}
