// Flat white glyphs in the style of Windows Phone tile and app bar icons
const paths: Record<string, string> = {
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v5M16 3v5M8 14h2M12 14h2M16 14h0M8 17h2M12 17h2',
  tasks: 'M4 6l2 2 3-3M4 12l2 2 3-3M4 18l2 2 3-3M12 7h8M12 13h8M12 19h8',
  notes: 'M5 3h10l4 4v14H5zM15 3v4h4M8 11h8M8 15h8M8 19h5',
  milestones: 'M6 21V3M6 4h11l-2 4 2 4H6',
  timeline: 'M7 3v18M7 6h0M4 6h6M4 12h6M4 18h6M13 6h7M13 12h5M13 18h7',
  budget: 'M3 7h18v12H3zM3 11h18M7 15h3M16 4H6',
  settings:
    'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1',
  claude: 'M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4',
  start: 'M3 5l8-1v7H3zM13 3.7L21 3v8h-8zM3 13h8v7l-8-1zM13 13h8v8l-8-1z',
  back: 'M19 12H5M11 6l-6 6 6 6',
  theme: 'M12 3a9 9 0 1 0 0 18zM12 3a9 9 0 0 1 0 18',
  power: 'M12 3v8M7 6.3a7 7 0 1 0 10 0',
  add: 'M12 5v14M5 12h14',
  resize: 'M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7',
}

export default function Glyph({ name, size = 24 }: { name: string; size?: number }) {
  return (
    <svg
      className="glyph"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="square"
      aria-hidden
    >
      <path d={paths[name]} fill={name === 'start' ? 'currentColor' : 'none'} />
    </svg>
  )
}
