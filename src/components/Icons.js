// Professional SVG icon library — stroke-based, uses currentColor for CSS inheritance
const S = ({ size = 18, strokeWidth = 2, children }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: "block", flexShrink: 0 }}
  >
    {children}
  </svg>
);

export const IconDashboard = ({ size = 18 }) => (
  <S size={size}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </S>
);

export const IconPayments = ({ size = 18 }) => (
  <S size={size}>
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
    <line x1="1" y1="10" x2="23" y2="10" />
  </S>
);

export const IconLearners = ({ size = 18 }) => (
  <S size={size}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </S>
);

export const IconBell = ({ size = 18 }) => (
  <S size={size}>
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </S>
);

export const IconChart = ({ size = 18 }) => (
  <S size={size}>
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </S>
);

export const IconFees = ({ size = 18 }) => (
  <S size={size}>
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 1 0 7H6" />
  </S>
);

export const IconFinance = ({ size = 18 }) => (
  <S size={size}>
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
  </S>
);

export const IconChat = ({ size = 18 }) => (
  <S size={size}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </S>
);

export const IconCalendar = ({ size = 18 }) => (
  <S size={size}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </S>
);

export const IconWallet = ({ size = 18 }) => (
  <S size={size}>
    <path d="M20 12V7H5a2 2 0 0 1 0-4h14v4" />
    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
    <path d="M18 12a2 2 0 0 0 0 4h4v-4z" />
  </S>
);

export const IconHome = ({ size = 18 }) => (
  <S size={size}>
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </S>
);

export const IconMenu = ({ size = 18 }) => (
  <S size={size}>
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </S>
);

export const IconX = ({ size = 18 }) => (
  <S size={size}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </S>
);

export const IconBolt = ({ size = 18 }) => (
  <S size={size}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </S>
);

export const IconWarning = ({ size = 18 }) => (
  <S size={size}>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </S>
);

export const IconCheck = ({ size = 18 }) => (
  <S size={size}>
    <polyline points="20 6 9 17 4 12" />
  </S>
);

export const IconMail = ({ size = 18 }) => (
  <S size={size}>
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </S>
);

export const IconLock = ({ size = 18 }) => (
  <S size={size}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </S>
);

export const IconEye = ({ size = 18 }) => (
  <S size={size}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </S>
);

export const IconEyeOff = ({ size = 18 }) => (
  <S size={size}>
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </S>
);

export const IconInfo = ({ size = 18 }) => (
  <S size={size}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </S>
);

export const IconSchool = ({ size = 18 }) => (
  <S size={size} strokeWidth={1.5}>
    <path d="M12 3L1 9l11 6 11-6-11-6z" />
    <path d="M5 12v6l7 3 7-3v-6" />
    <line x1="1" y1="9" x2="1" y2="15" />
  </S>
);

export const IconArrowRight = ({ size = 18 }) => (
  <S size={size}>
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </S>
);
