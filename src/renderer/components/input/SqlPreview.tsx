import type { SqlQueryResult } from '@/sql/contracts';

export function SqlPreview({ preview }: { preview: SqlQueryResult }) {
  return (
    <div className="data-summary mt-4">
      <h3>
        Preview of {preview.rows.length} rows, {preview.columns.length} columns
        ({preview.totalRowCount.toLocaleString()} total rows)
      </h3>
      <div className="sql-preview-table-container">
        <table>
          <thead>
            <tr>
              {preview.columns.map(col => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row, i) => (
              <tr key={i}>
                {preview.columns.map(col => (
                  <td key={col} title={row[col]}>
                    {row[col]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
