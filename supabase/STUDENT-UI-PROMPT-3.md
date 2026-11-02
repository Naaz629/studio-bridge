Small visual change for my Student UI (https://github.com/dlua0926/Studio-Bridge, React + Vite + TypeScript). The Tutor UI already uses a green, filled light bulb as the Questions icon. Please use exactly the same bulb in the Student UI so both apps match.

## What to change
1. Replace the chat-bubble icon in the Questions pane header (the `<svg>` before the "Questions" title in `.questions-header`) with the bulb below.
2. Replace the icon on the button that opens and closes the questions pane ("Hide questions sidebar", top-right) with the same bulb.
3. Keep that bulb button STATIC: it must stay in the same place on screen (top-right of the pane area) whether the questions pane is open or closed. Only the pane slides in and out. Do not move or hide the button when the pane opens. Keep the count badge on the button only while the pane is closed (the pane header already shows the count when it is open).
4. Nothing else in the Questions pane changes.

## The bulb (copy exactly; 24 x 24 in the header and 28 x 28 on the toggle button)
```tsx
export function BulbIcon({ size = 24 }: { size?: number }) {
  return (
    <svg className="bulb" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <g stroke="#3e6748" strokeWidth="3.4" strokeLinecap="round">
        <path d="M32 4v6" /><path d="M12.5 12l4.2 4.2" /><path d="M51.5 12l-4.2 4.2" />
        <path d="M4 31h6" /><path d="M54 31h6" /><path d="M12.5 50l4.2-4.2" /><path d="M51.5 50l-4.2-4.2" />
      </g>
      <path d="M32 14c-8.3 0-14.5 6-14.5 14 0 5 2.6 8.6 5.2 11.4 1.2 1.3 1.8 2.8 1.8 4.6h15c0-1.8.6-3.3 1.8-4.6 2.6-2.8 5.2-6.4 5.2-11.4 0-8-6.2-14-14.5-14z" fill="#3e6748" />
      <path d="M44 24c1.6 6-1 10.6-4.4 14.4-1.2 1.3-1.8 2.8-1.8 4.6h4.4c0-1.8.6-3.3 1.8-4.6 2.6-2.8 5.2-6.4 5.2-11.4 0-1.2-.2-2.4-.6-3.5z" fill="#2f5140" />
      <path d="M24 22c1.2-2.6 3.4-4.2 6-4.6" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" fill="none" opacity=".85" />
      <g fill="#2f5140"><rect x="24.5" y="48" width="15" height="3.4" rx="1.7" /><rect x="25.5" y="52.5" width="13" height="3.4" rx="1.7" /><rect x="27.5" y="57" width="9" height="3.4" rx="1.7" /></g>
    </svg>
  );
}
```

## The toggle button (reference: how the Tutor UI does it)
```css
.questions-toggle {            /* the one button that opens / closes the pane */
  position: fixed; top: 13px; right: 16px; z-index: 12;
  width: 34px; height: 34px; display: grid; place-items: center;
  background: #fff; border: 1px solid rgba(52, 75, 53, .12); border-radius: 10px;
  box-shadow: 0 1px 3px rgba(52, 75, 53, .06); cursor: pointer;
}
.questions-toggle .count-badge { position: absolute; top: -7px; right: -7px; }   /* hidden while the pane is open */
.questions-header { padding-right: 62px; }                                       /* room for the button */
```
Keep the existing accessible label ("Show questions" / "Hide questions") and keyboard behaviour.

## Test
Open the Student UI at 1024 x 768 and 1440 x 900. The green bulb appears in the pane header and on the toggle button, the toggle button does not move when the pane opens or closes, and the count badge shows only when the pane is closed. Show me the full code of every file you change.
