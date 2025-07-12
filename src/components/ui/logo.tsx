import * as React from 'react';

// Using an inline SVG to avoid issues with static file serving.
export function Logo(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="56"
      height="56"
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect width="56" height="56" rx="28" fill="#00529B" />
      <path
        d="M28 16V23M28 40V33M16 28H23M40 28H33M38.9997 19.34L33.0001 24M23 18L17.0003 22.66M38.9997 36.66L33.0001 32M23 38L17.0003 33.34"
        stroke="#FFC72B"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="28" cy="28" r="5" fill="#FFC72B" />
    </svg>
  );
}
