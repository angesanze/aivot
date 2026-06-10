import React from "react";

/* Tutte le icone dell'app in un posto solo: stesso stroke, stessa
   dimensione di default, override via className. */

const base = (props) => ({
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  className: "w-4 h-4 shrink-0",
  ...props,
});

export const FolderIcon = (p) => (
  <svg {...base(p)}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

export const BookIcon = (p) => (
  <svg {...base(p)}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);

export const CheckIcon = (p) => (
  <svg {...base({ strokeWidth: "3.5", className: "w-3 h-3 shrink-0", ...p })}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export const ChevronIcon = ({ open, ...p }) => (
  <svg
    {...base({
      strokeWidth: "2.5",
      className: `w-4 h-4 shrink-0 text-slate-400 transition-transform ${
        open ? "rotate-180" : ""
      }`,
      ...p,
    })}
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const PencilIcon = (p) => (
  <svg {...base(p)}>
    <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  </svg>
);

export const TrashIcon = (p) => (
  <svg {...base(p)}>
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
  </svg>
);

export const StoreIcon = (p) => (
  <svg {...base(p)}>
    <path d="m2 7 4.4-4.4A2 2 0 0 1 7.8 2h8.4a2 2 0 0 1 1.4.6L22 7" />
    <path d="M4 7v13a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V7" />
    <path d="M15 21v-6a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v6" />
  </svg>
);

export const SearchIcon = (p) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);
