import React from 'react';

export const Pin = (props: React.SVGProps<SVGSVGElement>) => {
  const isFilled = props.fill && props.fill !== "none";
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      fill="none"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={isFilled ? "currentColor" : "none"}
        d="M12 17v5M5 17h14v-1.76a2 2 0 00-.44-1.24l-2.33-2.92A2 2 0 0115.8 9.92V5a1 1 0 00-1-1H9.2a1 1 0 00-1 1v4.92a2 2 0 01-.43 1.16L5.44 14a2 2 0 00-.44 1.24z"
      />
    </svg>
  );
};
