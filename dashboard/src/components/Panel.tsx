import type { ReactNode } from "react";

interface PanelProps {
  title: string;
  /** Features this panel will have. Shown as a to-do list until implemented. */
  planned?: string[];
  wide?: boolean;
  children?: ReactNode;
}

export default function Panel({ title, planned, wide, children }: PanelProps) {
  return (
    <section className={wide ? "panel wide" : "panel"}>
      <h2>{title}</h2>
      {children}
      {planned && (
        <>
          <p className="hint">Not built yet. Planned:</p>
          <ul>
            {planned.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
