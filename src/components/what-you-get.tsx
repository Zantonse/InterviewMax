// What a card's button gives you, as a row of chips instead of a sentence listing it.
export function WhatYouGet({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="What you get">
      {items.map((item) => (
        <li
          key={item}
          className="flex items-center gap-1 rounded-full bg-accent-50 px-2.5 py-1 text-xs font-semibold text-ink-800 ring-1 ring-accent-200"
        >
          <span aria-hidden="true" className="text-accent-600">
            ✦
          </span>
          {item}
        </li>
      ))}
    </ul>
  );
}
