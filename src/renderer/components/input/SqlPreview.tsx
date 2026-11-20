import { SqlQueryResult } from '@/shared/types';

export function SqlPreview({ preview }: { preview: SqlQueryResult }) {
  return (
    <div className="data-summary mt-4">
      <h3>
        Preview of {preview.rowCount} rows, {preview.columns.length} columns
        {preview.totalRowCount !== undefined &&
          ` (${preview.totalRowCount.toLocaleString()} total rows)`}
      </h3>
      <div className="sql-preview-table-container">
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '12px',
          }}
        >
          <thead>
            <tr>
              {preview.columns.map(col => (
                <th
                  key={col}
                  style={{
                    padding: '6px 10px',
                    background: '#2d3748',
                    color: '#e2e8f0',
                    border: '1px solid #4a5568',
                    whiteSpace: 'nowrap',
                    position: 'sticky',
                    top: 0,
                    fontWeight: 600,
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row, i) => (
              <tr
                key={i}
                style={{
                  background: i % 2 === 0 ? '#3a4556' : '#4a5568',
                }}
              >
                {preview.columns.map(col => (
                  <td
                    key={col}
                    style={{
                      padding: '4px 10px',
                      border: '1px solid #4a5568',
                      color: '#e2e8f0',
                      maxWidth: '200px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={String(row[col] ?? '')}
                  >
                    {String(row[col] ?? '')}
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
