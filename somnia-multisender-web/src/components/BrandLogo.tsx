import React from "react";

interface BrandLogoProps {
  className?: string;
  width?: number;
  height?: number;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = "",
  width = 44,
  height = 28,
}) => {
  return (
    <svg
      viewBox="0 0 46 28"
      width={width}
      height={height}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`brand-mark-m ${className}`}
      aria-label="{m} mark"
      role="img"
    >
      {/* { */}
      <path
        d="M9 3C6.5 3 5 4.5 5 7v3.5c0 2-1.2 3.5-3.5 4.5 2.3 1 3.5 2.5 3.5 4.5V21c0 2.5 1.5 4 4 4"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* m */}
      <path
        d="M14 21V11.5M14 15.5c.8-2.8 2.5-4.5 5-4.5 2.4 0 4 1.6 4 4.2V21M23 15.5c.8-2.8 2.5-4.5 5-4.5 2.4 0 4 1.6 4 4.2V21"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* } */}
      <path
        d="M37 3c2.5 0 4 1.5 4 4v3.5c0 2 1.2 3.5 3.5 4.5-2.3 1-3.5 2.5-3.5 4.5V21c0 2.5-1.5 4-4 4"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};