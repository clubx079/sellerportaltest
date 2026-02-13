"use client";

import React from 'react';
import { FileText } from 'lucide-react';

const CMSPage = () => {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#F5F3FF] flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-[#472F97]" />
          </div>
          <h1 className="text-2xl font-semibold text-neutral-900 mb-2">Coming Soon</h1>
          <p className="text-sm text-neutral-500 max-w-sm">
            The Content Management System is currently under development. Stay tuned for updates.
          </p>
        </div>
    </div>
  );
};

export default CMSPage;
