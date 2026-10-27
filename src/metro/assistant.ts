// The Claude window belongs to ConnectClaude, which this theme hides; its
// tile and app bar button open it by pressing the hidden button.
export const openAssistant = () => document.querySelector<HTMLButtonElement>('.assistant-fab')?.click()
