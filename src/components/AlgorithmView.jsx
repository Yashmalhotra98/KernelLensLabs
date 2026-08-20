function AbstractMatrix({ label, role, children }) {
  return (
    <article className="algorithm-matrix-card">
      <header>
        <span className="matrix-letter">{label}</span>
        <div>
          <strong>{role}</strong>
          <small>8 × 8 · float32</small>
        </div>
      </header>
      {children}
    </article>
  )
}

function InputQuadrants({ axis }) {
  return (
    <div className="matrix-quadrants" aria-hidden="true">
      {Array.from({ length: 4 }, (_, index) => (
        <span key={index}>{axis}{index}</span>
      ))}
    </div>
  )
}

export function AlgorithmView({ blocks, selectedBlockId, onBlockSelect }) {
  return (
    <div className="algorithm-view lesson-view-enter" aria-label="Matrix multiplication algorithm overview">
      <div className="algorithm-equation">
        <AbstractMatrix label="A" role="Input rows">
          <InputQuadrants axis="R" />
        </AbstractMatrix>

        <span className="equation-symbol" aria-hidden="true">×</span>

        <AbstractMatrix label="B" role="Input columns">
          <InputQuadrants axis="C" />
        </AbstractMatrix>

        <span className="equation-symbol" aria-hidden="true">=</span>

        <AbstractMatrix label="C" role="Output tiles">
          <div className="output-tile-grid">
            {blocks.map((block) => (
              <button
                type="button"
                key={block.blockId}
                className="output-tile"
                data-status={block.status}
                data-selected={block.blockId === selectedBlockId ? 'true' : 'false'}
                onClick={() => onBlockSelect(block.blockId)}
                aria-pressed={block.blockId === selectedBlockId}
                aria-label={`Select output tile block ${block.coordinates.x}, ${block.coordinates.y}; ${block.status}`}
              >
                <span>B{block.blockId}</span>
                <small>({block.coordinates.x},{block.coordinates.y})</small>
              </button>
            ))}
          </div>
        </AbstractMatrix>
      </div>

      <div className="algorithm-callout">
        <span className="callout-index">01</span>
        <div>
          <strong>One output cell per CUDA thread</strong>
          <p>Each 4 × 4 tile becomes one independent thread block containing 16 threads.</p>
        </div>
      </div>
    </div>
  )
}
