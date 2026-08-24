import React from 'react';

export const FolderGit = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="size-6"
    {...props}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v3"
    />
    <circle cx="18" cy="18" r="3" />
    <circle cx="18" cy="11" r="1" />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M18 14v1"
    />
  </svg>
);
