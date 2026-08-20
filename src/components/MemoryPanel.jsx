function formatValue(value) {
  if (Number.isInteger(value)) return value
  return Number(value.toFixed(2))
}

function MatrixMemory({ label, values, activeIndices, operation }) {
  const activeSet = new Set(activeIndices)

  return (
    <article className="memory-card">
      <header>
        <div>
          <span className="memory-label">{label}</span>
          <span className="memory-space">global</span>
        </div>
        <span className="memory-operation">{operation}</span>
      </header>
      <div className="matrix-memory-grid">
        {values.map((value, index) => (
          <div
            key={`${label}-${index}`}
            className="memory-cell"
            data-active={activeSet.has(index) ? operation : undefined}
            title={`${label}[${index}] = ${formatValue(value)}`}
          >
            <span>{formatValue(value)}</span>
            <small>{index}</small>
          </div>
        ))}
      </div>
    </article>
  )
}

export function MemoryPanel({ simulation, frame, selectedThread }) {
  const registerValues = selectedThread?.registers ?? { row: 0, column: 0, k: null, sum: 0 }

  return (
    <section className="memory-panel" aria-labelledby="memory-heading">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Memory hierarchy</p>
          <h2 id="memory-heading" className="panel-title">Data movement</h2>
        </div>
        <span className="mode-chip">32-bit float cells</span>
      </div>

      <div className="memory-layout">
        <div className="global-memory-grid">
          <MatrixMemory
            label="A"
            values={simulation.matrices.A}
            activeIndices={frame.activeMemory.A}
            operation="read"
          />
          <MatrixMemory
            label="B"
            values={simulation.matrices.B}
            activeIndices={frame.activeMemory.B}
            operation="read"
          />
          <MatrixMemory
            label="C"
            values={frame.currentC}
            activeIndices={frame.activeMemory.C}
            operation="write"
          />
        </div>

        <aside className="memory-tiers" aria-label="Selected thread storage">
          <div className="storage-card storage-card-accent">
            <span>Registers · T{String(selectedThread?.threadId ?? 0).padStart(2, '0')}</span>
            <dl>
              <div><dt>row</dt><dd>{registerValues.row}</dd></div>
              <div><dt>col</dt><dd>{registerValues.column}</dd></div>
              <div><dt>k</dt><dd>{registerValues.k ?? '—'}</dd></div>
              <div><dt>sum</dt><dd>{formatValue(registerValues.sum)}</dd></div>
            </dl>
          </div>
          <div className="storage-card">
            <span>Shared memory</span>
            <strong>0 B</strong>
            <small>Unused by the naïve kernel</small>
          </div>
          <div className="storage-card">
            <span>Constant / local</span>
            <strong>Not used</strong>
            <small>Added in later lessons</small>
          </div>
        </aside>
      </div>
    </section>
  )
}
