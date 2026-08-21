import { useRef, useState } from 'react'

export function SourceEditor({
  source,
  activeLine,
  onChange,
  onRestore,
  filename = 'matmul.cu',
  ariaLabel = 'Editable CUDA kernel',
}) {
  const textareaRef = useRef(null)
  const [scrollTop, setScrollTop] = useState(0)
  const lineCount = source.split('\n').length
  const activeLineOffset = activeLine ? 16 + (activeLine - 1) * 28 : null
  const backgroundImage = activeLineOffset === null
    ? 'none'
    : `linear-gradient(to bottom, transparent 0, transparent ${activeLineOffset}px, var(--source-line-active) ${activeLineOffset}px, var(--source-line-active) ${activeLineOffset + 28}px, transparent ${activeLineOffset + 28}px)`

  function handleKeyDown(event) {
    if (event.key !== 'Tab') return

    event.preventDefault()
    const textarea = event.currentTarget
    const nextSource = `${source.slice(0, textarea.selectionStart)}  ${source.slice(textarea.selectionEnd)}`
    const nextCursor = textarea.selectionStart + 2

    onChange(nextSource)
    requestAnimationFrame(() => {
      textareaRef.current?.setSelectionRange(nextCursor, nextCursor)
    })
  }

  return (
    <section className="editor-panel" aria-labelledby="source-heading">
      <header className="panel-heading">
        <div>
          <p className="eyebrow">Editable source</p>
          <h2 id="source-heading" className="panel-title">{filename}</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="mode-chip">CUDA C++ · lesson subset</span>
          <button type="button" className="text-button" onClick={onRestore}>Restore sample</button>
        </div>
      </header>

      <div className="source-editor-frame">
        <div className="line-number-gutter" aria-hidden="true">
          <div style={{ transform: `translateY(-${scrollTop}px)` }}>
            {Array.from({ length: lineCount }, (_, index) => {
              const lineNumber = index + 1
              return (
                <div
                  key={lineNumber}
                  className={lineNumber === activeLine ? 'line-number line-number-active' : 'line-number'}
                >
                  {lineNumber}
                </div>
              )
            })}
          </div>
        </div>

        <textarea
          ref={textareaRef}
          className="source-textarea"
          value={source}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
          style={{ backgroundImage }}
          aria-label={ariaLabel}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck="false"
        />
      </div>

      <footer className="editor-footer">
        <span>{lineCount} lines</span>
        <span>{activeLine ? `Playback source line ${activeLine}` : 'Edit mode'}</span>
        <span>Not saved</span>
      </footer>
    </section>
  )
}
