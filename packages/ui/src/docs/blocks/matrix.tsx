import type { ReactNode } from 'react';
import { Text } from '../../components/text/text';

/**
 * Variant against state, drawn as a grid.
 *
 * The comparison is the documentation. Five variants described one after
 * another in prose is five paragraphs nobody reads; the same five as a grid
 * against `default / selected / disabled / loading` shows in one look which
 * cell is wrong, and it is always a cell, never a paragraph.
 */
export function Matrix<C extends string, R extends string>({
  columns,
  rows,
  cell,
  label,
}: {
  columns: readonly C[];
  rows: readonly R[];
  cell: (column: C, row: R) => ReactNode;
  label?: string;
}) {
  return (
    <figure className="my-6 overflow-x-auto rounded-lg border border-border-subtle bg-canvas">
      {label ? (
        <Text variant="column" tone="ghost" className="block px-4 pt-3">
          {label}
        </Text>
      ) : null}
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="w-0" />
            {columns.map((column) => (
              <th key={column} className="px-4 py-3 text-left">
                <Text variant="column" tone="meta">
                  {column}
                </Text>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row} className="border-border-divider border-t">
              <th className="whitespace-nowrap py-3 pr-4 pl-4 text-left align-middle">
                <Text variant="mono-sm" tone="ghost">
                  {row}
                </Text>
              </th>
              {columns.map((column) => (
                <td key={column} className="px-4 py-3 align-middle">
                  <div className="flex items-center">{cell(column, row)}</div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
