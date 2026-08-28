import { useEffect, useState } from 'react'
import { AppHeader } from './AppHeader.jsx'
import { DiagnosticsPanel } from './DiagnosticsPanel.jsx'
import { ExecutionControls } from './ExecutionControls.jsx'
import { RuntimeLessonCanvas } from './RuntimeLessonCanvas.jsx'
import { SourceEditor } from './SourceEditor.jsx'
import { createKernelLensRuntime } from '../runtime/createKernelLensRuntime.js'
import { createWebGpuComputeAdapter } from '../runtime/adapters/webGpuComputeAdapter.js'

const RUNTIME = createKernelLensRuntime({ webGpuAdapter: createWebGpuComputeAdapter() })

export function RuntimeLessonExperience({
  theme,
  onThemeChange,
  lessons,
  selectedLessonId,
  onLessonChange,
}) {
  const session = RUNTIME.openLesson(selectedLessonId)
  const lesson = session.lesson
  const previewRecording = lesson.createRecording([])
  const lastFrameIndex = previewRecording.frames.length - 1
  const [source, setSource] = useState(() => lesson.source)
  const [analysis, setAnalysis] = useState(null)
  const [result, setResult] = useState(null)
  const [frameIndex, setFrameIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [preferWebGpu, setPreferWebGpu] = useState(true)

  const recording = result?.recording ?? previewRecording
  const frame = recording.frames[frameIndex]
  const activeLine = frame.sourceKey && analysis?.canSimulate ? analysis.lineMap[frame.sourceKey] : null

  let executionStatus = 'source edited'
  if (analysis?.hasErrors) executionStatus = 'analysis error'
  else if (isExecuting) executionStatus = 'validating output'
  else if (isPlaying) executionStatus = 'running simulation'
  else if (result && frameIndex === lastFrameIndex) executionStatus = 'complete'
  else if (result && frameIndex > 0) executionStatus = 'paused'
  else if (analysis?.canSimulate) executionStatus = 'ready'

  useEffect(() => {
    if (!isPlaying || frameIndex >= lastFrameIndex) return undefined

    const timerId = window.setTimeout(() => {
      const nextFrameIndex = Math.min(frameIndex + 1, lastFrameIndex)
      setFrameIndex(nextFrameIndex)
      if (nextFrameIndex === lastFrameIndex) setIsPlaying(false)
    }, 620)

    return () => window.clearTimeout(timerId)
  }, [frameIndex, isPlaying, lastFrameIndex])

  function handleSourceChange(nextSource) {
    setSource(nextSource)
    setAnalysis(null)
    setResult(null)
    setIsPlaying(false)
    setFrameIndex(0)
  }

  function handleAnalyze() {
    setIsPlaying(false)
    setFrameIndex(0)
    setAnalysis(lesson.analyze(source))
  }

  async function executeCurrentSource() {
    const nextAnalysis = lesson.analyze(source)
    setAnalysis(nextAnalysis)
    if (!nextAnalysis.canSimulate) return null

    setIsExecuting(true)
    try {
      const nextResult = await session.run({ source, preferWebGpu })
      setResult(nextResult)
      return nextResult
    } finally {
      setIsExecuting(false)
    }
  }

  async function handleRun() {
    setIsPlaying(false)
    const nextResult = await executeCurrentSource()
    if (!nextResult) return
    setFrameIndex(0)
    setIsPlaying(true)
  }

  async function handleStep() {
    setIsPlaying(false)
    const nextResult = result ?? await executeCurrentSource()
    if (nextResult) setFrameIndex((currentIndex) => Math.min(currentIndex + 1, lastFrameIndex))
  }

  function handleReset() {
    setIsPlaying(false)
    setFrameIndex(0)
  }

  function handleRestoreSample() {
    setSource(lesson.source)
    setAnalysis(null)
    setResult(null)
    setIsPlaying(false)
    setFrameIndex(0)
  }

  const controls = (
    <ExecutionControls
      status={executionStatus}
      isPlaying={isPlaying}
      frameIndex={frameIndex}
      frameCount={recording.frames.length}
      onAnalyze={handleAnalyze}
      onRun={handleRun}
      onPause={() => setIsPlaying(false)}
      onStep={handleStep}
      onReset={handleReset}
    />
  )

  return (
    <div className="app-shell" data-theme={theme}>
      <AppHeader controls={controls} lessons={lessons} selectedLessonId={selectedLessonId} onLessonChange={onLessonChange} theme={theme} onThemeChange={onThemeChange} />

      <main className="workspace-grid">
        <div className="source-column">
          <SourceEditor source={source} activeLine={activeLine} onChange={handleSourceChange} onRestore={handleRestoreSample} filename={lesson.filename} ariaLabel={`Editable source for ${lesson.title}`} />
          <DiagnosticsPanel analysis={analysis} />
        </div>

        <section className="execution-panel gpu-grid" aria-labelledby="runtime-lesson-heading">
          <div className="execution-heading">
            <div>
              <p className="eyebrow">{lesson.view.eyebrow}</p>
              <h2 id="runtime-lesson-heading">{lesson.view.headline}</h2>
              <p>{lesson.view.description}</p>
            </div>
            <div className="fidelity-badge"><span /> {lesson.view.fidelity}</div>
          </div>

          <RuntimeLessonCanvas lesson={lesson} frame={frame} result={result} preferWebGpu={preferWebGpu} onPreferWebGpuChange={setPreferWebGpu} />

          <footer className="execution-footnote">
            <span>Trace: {recording.engine}</span>
            <span>{lesson.view.topology}</span>
          </footer>
        </section>
      </main>

      <footer className="app-footer">
        <span>Source stays in this browser and is never executed or saved</span>
        <span>Educational trace · CPU-verified mathematics · explicit fidelity labels</span>
      </footer>
    </div>
  )
}
