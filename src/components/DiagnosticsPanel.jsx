export function DiagnosticsPanel({ analysis }) {
  if (!analysis) {
    return (
      <section className="diagnostics-panel" aria-labelledby="diagnostics-heading">
        <div className="diagnostics-summary">
          <div>
            <p className="eyebrow">Diagnostics</p>
            <h2 id="diagnostics-heading" className="panel-title">Waiting for analysis</h2>
          </div>
          <span className="diagnostic-count">—</span>
        </div>
        <p className="diagnostic-empty">Select Analyze or Run to inspect the supported CUDA lesson structure.</p>
      </section>
    )
  }

  const errorCount = analysis.diagnostics.filter((item) => item.severity === 'error').length
  const warningCount = analysis.diagnostics.filter((item) => item.severity === 'warning').length

  return (
    <section className="diagnostics-panel" aria-labelledby="diagnostics-heading">
      <div className="diagnostics-summary">
        <div>
          <p className="eyebrow">Diagnostics</p>
          <h2 id="diagnostics-heading" className="panel-title">
            {analysis.canSimulate ? 'Ready to simulate' : 'Source needs attention'}
          </h2>
        </div>
        <span className="diagnostic-count">{errorCount}E · {warningCount}W</span>
      </div>

      {analysis.diagnostics.length === 0 ? (
        <div className="diagnostic-success">
          <span aria-hidden="true">✓</span>
          <p>No issues found by the browser lesson analyzer.</p>
        </div>
      ) : (
        <ol className="diagnostic-list">
          {analysis.diagnostics.map((diagnostic, index) => (
            <li key={`${diagnostic.code}-${diagnostic.line}-${index}`} className="diagnostic-item" data-severity={diagnostic.severity}>
              <div className="diagnostic-meta">
                <span>{diagnostic.severity}</span>
                <span>{diagnostic.code}</span>
                <span>line {diagnostic.line}</span>
              </div>
              <p>{diagnostic.message}</p>
              {diagnostic.suggestion ? <small>{diagnostic.suggestion}</small> : null}
            </li>
          ))}
        </ol>
      )}

      <p className="diagnostic-disclaimer">
        Educational static analysis—not authoritative NVCC compilation.
      </p>
    </section>
  )
}
