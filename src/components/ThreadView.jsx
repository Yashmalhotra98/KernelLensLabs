function formatValue(value) {
  if (Number.isInteger(value)) return value
  return Number(value.toFixed(2))
}

export function ThreadView({ block, frame, selectedThread, simulation }) {
  const { coordinates, laneId, registers, threadId, threadState } = selectedThread
  const hasLoopIndex = registers.k !== null
  const aIndex = hasLoopIndex ? registers.row * simulation.size + registers.k : null
  const bIndex = hasLoopIndex ? registers.k * simulation.size + registers.column : null
  const cIndex = registers.row * simulation.size + registers.column
  const aValue = aIndex === null ? null : simulation.matrices.A[aIndex]
  const bValue = bIndex === null ? null : simulation.matrices.B[bIndex]

  return (
    <div className="thread-view lesson-view-enter" aria-label={`Thread ${threadId} register and address view`}>
      <article className="thread-identity-card">
        <div className="thread-identity-mark">T{String(threadId).padStart(2, '0')}</div>
        <div>
          <span className="eyebrow">One CUDA thread · lane {laneId}</span>
          <h3>Owns C[{registers.row}, {registers.column}]</h3>
          <p>blockIdx ({block.coordinates.x}, {block.coordinates.y}) · threadIdx ({coordinates.x}, {coordinates.y})</p>
        </div>
        <span className="thread-state-pill" data-state={threadState}>{threadState}</span>
      </article>

      <div className="thread-detail-grid">
        <section className="index-math-card">
          <span className="eyebrow">Index calculation</span>
          <div className="index-equation">
            <span>row</span>
            <code>{block.coordinates.y} × 4 + {coordinates.y}</code>
            <strong>{registers.row}</strong>
          </div>
          <div className="index-equation">
            <span>column</span>
            <code>{block.coordinates.x} × 4 + {coordinates.x}</code>
            <strong>{registers.column}</strong>
          </div>
          <div className="index-equation">
            <span>C address</span>
            <code>{registers.row} × 8 + {registers.column}</code>
            <strong>C[{cIndex}]</strong>
          </div>
        </section>

        <section className="register-file-card">
          <span className="eyebrow">Private registers</span>
          <dl>
            <div><dt>row</dt><dd>{registers.row}</dd></div>
            <div><dt>column</dt><dd>{registers.column}</dd></div>
            <div><dt>k</dt><dd>{registers.k ?? '—'}</dd></div>
            <div><dt>sum</dt><dd>{formatValue(registers.sum)}</dd></div>
          </dl>
          <small>Conceptual values—not a measured physical register allocation.</small>
        </section>
      </div>

      <section className="thread-memory-journey">
        <header>
          <div>
            <span className="eyebrow">Current memory journey</span>
            <strong>{frame.title}</strong>
          </div>
          <span>k = {registers.k ?? 'not started'}</span>
        </header>

        {hasLoopIndex ? (
          <div className="operand-flow">
            <div><span>Global A</span><strong>A[{aIndex}] = {formatValue(aValue)}</strong></div>
            <b aria-hidden="true">×</b>
            <div><span>Global B</span><strong>B[{bIndex}] = {formatValue(bValue)}</strong></div>
            <b aria-hidden="true">→</b>
            <div><span>Register sum</span><strong>{formatValue(registers.sum)}</strong></div>
            <b aria-hidden="true">→</b>
            <div><span>Global C</span><strong>C[{cIndex}]</strong></div>
          </div>
        ) : (
          <p className="memory-waiting">The operand addresses become active when the loop reaches its first value of k.</p>
        )}
      </section>
    </div>
  )
}
