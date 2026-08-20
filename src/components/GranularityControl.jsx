import { VISUALIZATION_LEVELS } from '../lib/visualizationLevels.js'

export function GranularityControl({ value, onChange }) {
  const currentIndex = VISUALIZATION_LEVELS.findIndex((level) => level.id === value)
  const currentLevel = VISUALIZATION_LEVELS[currentIndex]
  const progress = (currentIndex / (VISUALIZATION_LEVELS.length - 1)) * 100

  return (
    <section className="granularity-control" aria-labelledby="granularity-heading">
      <div className="granularity-heading">
        <div>
          <span className="eyebrow" id="granularity-heading">View granularity</span>
          <strong>{currentLevel.label}</strong>
        </div>
        <span>Move right to inspect finer GPU detail</span>
      </div>

      <input
        className="granularity-range"
        type="range"
        min="0"
        max={VISUALIZATION_LEVELS.length - 1}
        step="1"
        value={currentIndex}
        onChange={(event) => onChange(VISUALIZATION_LEVELS[Number(event.target.value)].id)}
        aria-label="GPU visualization granularity"
        aria-valuetext={`${currentLevel.label}: ${currentLevel.detail}`}
        style={{ '--scope-progress': `${progress}%` }}
      />

      <div className="granularity-labels">
        {VISUALIZATION_LEVELS.map((level, index) => (
          <button
            type="button"
            key={level.id}
            className="granularity-stop"
            data-active={level.id === value ? 'true' : 'false'}
            onClick={() => onChange(level.id)}
            aria-current={level.id === value ? 'step' : undefined}
          >
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{level.label}</strong>
            <small>{level.detail}</small>
          </button>
        ))}
      </div>
    </section>
  )
}
