'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Activities have been moved to Settings → Activities tab.
 * Redirect so old links and bookmarks still work.
 */
export default function ActivitiesRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/settings?tab=activities');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <p className="text-sm text-gray-500">Redirecting to Activities…</p>
    </div>
  );
}
