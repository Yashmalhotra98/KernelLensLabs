function getNarrative(level, { block, frame, gpuFrame, selectedThread }) {
  if (level === 'algorithm') {
    return {
      what: 'The 8 × 8 output matrix is divided into four independent 4 × 4 tiles.',
      why: 'A tile maps naturally to one CUDA thread block, so the GPU can schedule tiles independently.',
      notice: `Block B${block.blockId} owns rows ${block.coordinates.y * 4}–${block.coordinates.y * 4 + 3} and columns ${block.coordinates.x * 4}–${block.coordinates.x * 4 + 3}.`,
    }
  }

  if (level === 'gpu') {
    return {
      what: `Scheduling wave ${gpuFrame.waveIndex + 1} assigns ${gpuFrame.sms.filter((sm) => sm.activeBlock).length} block${gpuFrame.tailEffect ? '' : 's'} to three virtual SMs.`,
      why: gpuFrame.tailEffect
        ? 'Only one block remains, so two SMs have no work. This under-utilized final wave is called the tail effect.'
        : 'Independent blocks can execute concurrently because they do not rely on a global block execution order.',
      notice: 'The assignment is deterministic for teaching. Real CUDA hardware controls block-to-SM scheduling.',
    }
  }

  if (level === 'block') {
    return {
      what: frame.description,
      why: 'The block owns one output tile, while each of its 16 threads owns one cell inside that tile.',
      notice: `The selected block is assigned to virtual SM ${block.smId} during wave ${block.wave + 1}.`,
    }
  }

  if (level === 'warp') {
    return {
      what: `Warp 0 broadcasts “${frame.title}” to its allocated lanes.`,
      why: 'CUDA executes threads in fixed-size groups called warps using a single-instruction, multiple-thread model.',
      notice: 'This 16-thread block occupies lanes 0–15 of a 32-lane warp; lanes 16–31 are inactive.',
    }
  }

  return {
    what: `Thread T${String(selectedThread.threadId).padStart(2, '0')} is responsible for C[${selectedThread.registers.row}, ${selectedThread.registers.column}].`,
    why: 'The row and column registers give this thread a stable output address while k advances through the dot product.',
    notice: 'Registers are private to this thread; global memory is visible across the device.',
  }
}

export function LearningNarrative({ level, context }) {
  const narrative = getNarrative(level, context)

  return (
    <aside className="learning-narrative" aria-label="Beginner explanation">
      <div><span>What happened?</span><p>{narrative.what}</p></div>
      <div><span>Why?</span><p>{narrative.why}</p></div>
      <div><span>Notice</span><p>{narrative.notice}</p></div>
    </aside>
  )
}
