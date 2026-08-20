export const SM_COUNT = 3

export const VIRTUAL_BLOCKS = [
  { blockId: 0, coordinates: { x: 0, y: 0, z: 0 }, smId: 0, wave: 0 },
  { blockId: 1, coordinates: { x: 1, y: 0, z: 0 }, smId: 1, wave: 0 },
  { blockId: 2, coordinates: { x: 0, y: 1, z: 0 }, smId: 2, wave: 0 },
  { blockId: 3, coordinates: { x: 1, y: 1, z: 0 }, smId: 0, wave: 1 },
]

export const WAVE_COUNT = 2

function phaseToBlockState(phase) {
  if (phase === 'ready') return 'assigned'
  if (phase === 'read') return 'read'
  if (phase === 'write') return 'write'
  if (phase === 'complete') return 'complete'
  return 'compute'
}

export function getVirtualGpuFrame({ frameIndex, blockFrameCount, activePhase }) {
  const totalFrameCount = blockFrameCount * WAVE_COUNT

  if (!Number.isInteger(blockFrameCount) || blockFrameCount <= 0) {
    throw new Error('Block frame count must be a positive integer.')
  }

  if (!Number.isInteger(frameIndex) || frameIndex < 0 || frameIndex >= totalFrameCount) {
    throw new Error(`Frame index must be between 0 and ${totalFrameCount - 1}.`)
  }

  const waveIndex = Math.floor(frameIndex / blockFrameCount)
  const localFrameIndex = frameIndex % blockFrameCount
  const activeBlockState = phaseToBlockState(activePhase)

  const blocks = VIRTUAL_BLOCKS.map((block) => {
    let status = 'queued'
    if (block.wave < waveIndex) status = 'complete'
    if (block.wave === waveIndex) status = activeBlockState

    return { ...block, status }
  })

  const sms = Array.from({ length: SM_COUNT }, (_, smId) => {
    const activeBlock = blocks.find((block) => block.wave === waveIndex && block.smId === smId)
    return {
      smId,
      activeBlock: activeBlock ?? null,
      status: activeBlock ? activeBlock.status : 'idle',
    }
  })

  return {
    frameIndex,
    totalFrameCount,
    waveIndex,
    waveCount: WAVE_COUNT,
    localFrameIndex,
    blocks,
    sms,
    queuedBlocks: blocks.filter((block) => block.status === 'queued'),
    completedBlocks: blocks.filter((block) => block.status === 'complete'),
    tailEffect: sms.filter((sm) => sm.activeBlock).length < SM_COUNT,
  }
}

export function getBlockLocalFrameIndex(block, gpuFrame, blockFrameCount) {
  if (block.wave < gpuFrame.waveIndex) return blockFrameCount - 1
  if (block.wave > gpuFrame.waveIndex) return 0
  return gpuFrame.localFrameIndex
}
