import React from 'react';

export const Server = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="size-6"
    {...props}
  >
    <rect width="20" height="8" x="2" y="2" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round" />
    <rect width="20" height="8" x="2" y="14" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="6" y1="6" x2="6.01" y2="6" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="6" y1="18" x2="6.01" y2="18" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="10" y1="6" x2="10.01" y2="6" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="10" y1="18" x2="10.01" y2="18" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
