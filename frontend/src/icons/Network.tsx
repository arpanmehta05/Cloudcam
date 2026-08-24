import React from 'react';

export const Network = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="size-6"
    {...props}
  >
    <rect width="6" height="6" x="16" y="16" rx="1" strokeLinecap="round" strokeLinejoin="round" />
    <rect width="6" height="6" x="2" y="16" rx="1" strokeLinecap="round" strokeLinejoin="round" />
    <rect width="6" height="6" x="9" y="2" rx="1" strokeLinecap="round" strokeLinejoin="round" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3M12 12V8" />
  </svg>
);
