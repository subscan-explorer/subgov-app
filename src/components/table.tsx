import { cn } from "@/lib/utils";

export function Table({
  columns,
  rows,
  className,
}: {
  columns: { key: string; label: string; className?: string }[];
  rows: Record<string, React.ReactNode>[];
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 overflow-x-auto", className)}>
      <table className="subscan-table w-full text-left text-sm">
        <thead className="bg-panel-2 text-xs font-medium text-mute">
          <tr>
            {columns.map((c) => (
              <th scope="col" key={c.key} className={cn("leading-snug whitespace-nowrap", c.className)}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="group">
              {columns.map((c) => (
                <td key={c.key} className={cn("align-top leading-snug", c.className)}>
                  {row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
