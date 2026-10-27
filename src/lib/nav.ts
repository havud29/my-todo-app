// The app's pages, in the order they appear in the sidebar, the phone tab bar
// and the Classic Start menu. To add a page, add one entry here, render it in
// App.tsx, and add public/aero/<route>.svg for the Classic theme.
export const pages = [
  { route: 'calendar', label: 'Calendar', icon: '◷', hint: 'Plan your days and weeks' },
  { route: 'tasks', label: 'Tasks', icon: '✓', hint: 'Your to-do lists' },
  { route: 'notes', label: 'Notes', icon: '✎', hint: 'Ideas and journal' },
  { route: 'budget', label: 'Budget', icon: '$', hint: 'Track spending and income' },
] as const

export type Route = (typeof pages)[number]['route']

export const defaultRoute: Route = 'calendar'
