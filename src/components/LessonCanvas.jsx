import { AlgorithmView } from './AlgorithmView.jsx'
import { GpuOverview } from './GpuOverview.jsx'
import { LearningNarrative } from './LearningNarrative.jsx'
import { ThreadBlock } from './ThreadBlock.jsx'
import { ThreadView } from './ThreadView.jsx'
import { WarpView } from './WarpView.jsx'

function BlockView({ block, frame, selectedThreadId, onThreadSelect }) {
  const rowStart = block.coordinates.y * 4
  const columnStart = block.coordinates.x * 4

  return (
    <div className="block-view lesson-view-enter">
      <div className="scope-event-bar">
        <div><span className="eyebrow">Current block event</span><strong>{frame.title}</strong></div>
        <span>{frame.description}</span>
      </div>
      <ThreadBlock
        blockId={`${block.coordinates.x}, ${block.coordinates.y}, 0`}
        threads={frame.threads}
        selectedThreadId={selectedThreadId}
        onThreadSelect={onThreadSelect}
      />
      <div className="block-resource-strip">
        <div><span>Output tile</span><strong>Rows {rowStart}–{rowStart + 3} · Cols {columnStart}–{columnStart + 3}</strong></div>
        <div><span>Execution</span><strong>1 warp · 16 allocated lanes</strong></div>
        <div><span>Shared memory</span><strong>0 B · naïve kernel</strong></div>
      </div>
    </div>
  )
}

export function LessonCanvas({
  level,
  gpuFrame,
  simulation,
  frame,
  selectedBlock,
  selectedThread,
  selectedThreadId,
  onBlockSelect,
  onThreadSelect,
}) {
  let view

  if (level === 'algorithm') {
    view = (
      <AlgorithmView
        blocks={gpuFrame.blocks}
        selectedBlockId={selectedBlock.blockId}
        onBlockSelect={onBlockSelect}
      />
    )
  } else if (level === 'gpu') {
    view = (
      <GpuOverview
        gpuFrame={gpuFrame}
        selectedBlockId={selectedBlock.blockId}
        onBlockSelect={onBlockSelect}
      />
    )
  } else if (level === 'block') {
    view = (
      <BlockView
        block={selectedBlock}
        frame={frame}
        selectedThreadId={selectedThreadId}
        onThreadSelect={onThreadSelect}
      />
    )
  } else if (level === 'warp') {
    view = (
      <WarpView
        frame={frame}
        selectedThreadId={selectedThreadId}
        onThreadSelect={onThreadSelect}
      />
    )
  } else {
    view = (
      <ThreadView
        block={selectedBlock}
        frame={frame}
        selectedThread={selectedThread}
        simulation={simulation}
      />
    )
  }

  return (
    <>
      <div className="scope-breadcrumb" aria-label="Current GPU scope">
        <span>Kernel</span><i>/</i>
        <span>Grid 2×2</span><i>/</i>
        <strong>SM {selectedBlock.smId}</strong><i>/</i>
        <strong>Block ({selectedBlock.coordinates.x},{selectedBlock.coordinates.y})</strong><i>/</i>
        <strong>Warp 0</strong><i>/</i>
        <strong>T{String(selectedThreadId).padStart(2, '0')}</strong>
      </div>

      <div className="lesson-viewport" data-level={level}>
        {view}
      </div>

      <LearningNarrative
        level={level}
        context={{ block: selectedBlock, frame, gpuFrame, selectedThread }}
      />
    </>
  )
}
