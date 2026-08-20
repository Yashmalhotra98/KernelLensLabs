import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getBlockLocalFrameIndex,
  getVirtualGpuFrame,
  VIRTUAL_BLOCKS,
} from '../src/lib/virtualGpuScheduler.js'

const BLOCK_FRAME_COUNT = 22

test('maps four output blocks onto three SMs in two scheduling waves', () => {
  assert.deepEqual(
    VIRTUAL_BLOCKS.map(({ blockId, smId, wave }) => ({ blockId, smId, wave })),
    [
      { blockId: 0, smId: 0, wave: 0 },
      { blockId: 1, smId: 1, wave: 0 },
      { blockId: 2, smId: 2, wave: 0 },
      { blockId: 3, smId: 0, wave: 1 },
    ],
  )
})

test('fills all three SMs during the first wave and queues the fourth block', () => {
  const frame = getVirtualGpuFrame({ frameIndex: 0, blockFrameCount: BLOCK_FRAME_COUNT, activePhase: 'ready' })

  assert.deepEqual(frame.sms.map((sm) => sm.activeBlock?.blockId), [0, 1, 2])
  assert.deepEqual(frame.queuedBlocks.map((block) => block.blockId), [3])
  assert.equal(frame.tailEffect, false)
})

test('shows the tail effect during the second wave', () => {
  const frame = getVirtualGpuFrame({
    frameIndex: BLOCK_FRAME_COUNT,
    blockFrameCount: BLOCK_FRAME_COUNT,
    activePhase: 'ready',
  })

  assert.deepEqual(frame.sms.map((sm) => sm.activeBlock?.blockId ?? null), [3, null, null])
  assert.equal(frame.completedBlocks.length, 3)
  assert.equal(frame.tailEffect, true)
})

test('returns local trace frames for active and completed blocks', () => {
  const waveTwo = getVirtualGpuFrame({
    frameIndex: BLOCK_FRAME_COUNT + 5,
    blockFrameCount: BLOCK_FRAME_COUNT,
    activePhase: 'read',
  })

  assert.equal(getBlockLocalFrameIndex(VIRTUAL_BLOCKS[0], waveTwo, BLOCK_FRAME_COUNT), 21)
  assert.equal(getBlockLocalFrameIndex(VIRTUAL_BLOCKS[3], waveTwo, BLOCK_FRAME_COUNT), 5)
})
