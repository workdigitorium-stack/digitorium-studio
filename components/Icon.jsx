/* Line icons drawn on a 24px grid, stroke follows currentColor. */
const PATHS = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  leads: "M4 4h16v12H5.5L4 17.5zM8 9h8M8 12h5",
  media: "M4 5h16v14H4zM4 15l4.5-4.5 4 4 3-3L20 16M15.5 9.5h.01",
  pages: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7",
  posts: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  seo: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4",
  brand: "M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-.5-.2-.8-.4-1.1-.3-.3-.4-.6-.4-1.1 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5c0-4.1-4-7.6-9-7.6zM7.5 12h.01M10 7.5h.01M15 7.5h.01",
  users: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  account: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21v-1a7 7 0 0 1 7-7h2a7 7 0 0 1 7 7v1",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z",
  whatsapp: "M3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 8 19.4zM9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.6-2-1-1 .8a4.5 4.5 0 0 1-2.2-2.2l.8-1-1-2z",
  mail: "M3 5h18v14H3zM3 6l9 7 9-7",
  upload: "M12 16V4M7 9l5-5 5 5M4 16v4h16v-4",
  download: "M12 4v12M7 11l5 5 5-5M4 20h16",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6",
  restore: "M3 12a9 9 0 1 0 3-6.7M3 4v5h5",
  close: "M6 6l12 12M18 6 6 18",
  back: "M15 5l-7 7 7 7",
  plus: "M12 5v14M5 12h14",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4",
  video: "M4 6h11v12H4zM15 10l5-3v10l-5-3",
  photo: "M4 5h16v14H4zM4 15l4.5-4.5 4 4 3-3L20 16",
  external: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
  copy: "M8 8h12v12H8zM4 16V4h12",
  edit: "M4 20h4L19 9l-4-4L4 16z",
  logout: "M15 4h4v16h-4M10 16l4-4-4-4M14 12H4",
  bell: "M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0",
  check: "M5 12.5l4.5 4.5L19 7.5",
  folder: "M3 6h6l2 2h10v11H3z",
  bin: "M4 7h16M6 7l1 13h10l1-13M9 7V4h6v3",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  activity: "M3 12h4l3-8 4 16 3-8h4",
  inbox: "M3 13l3-8h12l3 8v6H3zM3 13h5l1 2h6l1-2h5",
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  history: "M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2",
  up: "M12 19V5M6 11l6-6 6 6",
  down: "M12 5v14M6 13l6 6 6-6",
  publish: "M12 15V3M7 8l5-5 5 5M5 21h14",
  chair: "M7 3h10v8H7zM5 11h14v3H5zM8 14l-1 7M16 14l1 7M12 14v4M8 18h8",
  star: "M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z",
  tag: "M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9zM7.5 7.5h.01",
  menu: "M4 7h16M4 12h16M4 17h16",
  next: "M9 5l7 7-7 7",
  select: "M4 4h16v16H4zM8 12l3 3 5-6",
  linkedin: "M4 4h16v16H4zM8 10v6M8 7.5h.01M12 16v-6M12 13a2.5 2.5 0 0 1 5 0v3",
};

export default function Icon({ name, size, ...rest }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" width={size} height={size} aria-hidden="true" {...rest}>
      <path d={PATHS[name] || ""} />
    </svg>
  );
}
