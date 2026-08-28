import { defineLesson } from './lessonFactory.js'

export const VECTOR_ADD_SOURCE = `__global__ void vectorAdd(
    const float* A,
    const float* B,
    float* C,
    int N)
{
    int index = blockIdx.x * blockDim.x + threadIdx.x;

    if (index < N) {
        C[index] = A[index] + B[index];
    }
}`

const INPUT_A = [1, 2, 3, 4, 5, 6, 7, 8]
const INPUT_B = [8, 7, 6, 5, 4, 3, 2, 1]

export const vectorAddLesson = defineLesson({
  id: 'vector-add.basic',
  title: 'Vector Addition',
  shortTitle: 'Vector Add',
  category: 'Foundations',
  description: 'One-dimensional indexing, coalesced reads, arithmetic, and global-memory writes.',
  filename: 'vector_add.cu',
  source: VECTOR_ADD_SOURCE,
  inputs: { a: INPUT_A, b: INPUT_B },
  computeRequest: {
    operation: 'vector-add',
    inputs: { a: INPUT_A, b: INPUT_B },
  },
  capabilities: { webGpuValidation: true },
  view: {
    eyebrow: 'Foundations · Vector addition',
    headline: 'One thread, one output element',
    description: 'Follow CUDA indexing from source code to logical lanes and adjacent memory addresses.',
    topology: 'Grid 1 × 1 · Block 8 × 1 · 8 active lanes · Warp size 32',
    fidelity: 'Deterministic trace · computed validation',
  },
  analysis: {
    lessonCode: 'VEC',
    requiredPatterns: [
      {
        pattern: /__global__\s+void\s+vectorAdd\s*\(/,
        message: "This lesson requires an '__global__ void vectorAdd(...)' kernel.",
        suggestion: 'Restore the vectorAdd entry point.',
      },
      {
        pattern: /\bblockIdx\.x\b[\s\S]*\bblockDim\.x\b[\s\S]*\bthreadIdx\.x\b/,
        message: 'No one-dimensional CUDA thread index was recognized.',
        suggestion: 'Compute index from blockIdx.x, blockDim.x, and threadIdx.x.',
      },
      {
        pattern: /\bC\s*\[[^\]]+\]\s*=\s*A\s*\[[^\]]+\]\s*\+\s*B\s*\[[^\]]+\]\s*;/,
        message: 'No supported element-wise addition was recognized.',
        suggestion: 'Assign C[index] = A[index] + B[index].',
      },
    ],
    linePatterns: {
      index: /\bint\s+index\b/,
      read: /\bC\s*\[.*\]\s*=/,
      compute: /\bC\s*\[.*\]\s*=/,
      write: /\bC\s*\[.*\]\s*=/,
    },
  },
  topology: { threadCount: 8 },
  memorySpaces: [
    { id: 'a', label: 'Vector A', kind: 'global', values: INPUT_A },
    { id: 'b', label: 'Vector B', kind: 'global', values: INPUT_B },
    { id: 'c', label: 'Vector C', kind: 'global', values: (output) => output },
  ],
  stages: [
    {
      phase: 'launch',
      state: 'idle',
      sourceKey: 'index',
      title: 'Launch one thread per element',
      description: 'Eight logical threads are assigned to eight output positions.',
      expression: 'index = blockIdx.x × blockDim.x + threadIdx.x',
    },
    {
      phase: 'read',
      state: 'read',
      sourceKey: 'read',
      title: 'Read A[index] and B[index]',
      description: 'Adjacent lanes request adjacent addresses that can be combined into memory transactions.',
      expression: 'load A[index], B[index]',
      activeMemory: ['a', 'b'],
      memoryOperation: { a: 'coalesced read', b: 'coalesced read' },
    },
    {
      phase: 'compute',
      state: 'compute',
      sourceKey: 'compute',
      title: 'Add operands in parallel',
      description: 'Every active lane executes the same addition on a different element.',
      expression: 'A[index] + B[index]',
    },
    {
      phase: 'write',
      state: 'write',
      sourceKey: 'write',
      title: 'Write each result to C',
      description: 'Each lane owns a distinct output address.',
      expression: 'C[index] = sum',
      showResults: true,
      activeMemory: ['c'],
      memoryOperation: { c: 'coalesced write' },
    },
    {
      phase: 'complete',
      state: 'complete',
      title: 'Kernel complete',
      description: 'The computed vector is ready for validation against the CPU reference.',
      expression: 'complete',
      showResults: true,
    },
  ],
})

export const analyzeVectorAddSource = vectorAddLesson.analyze
export const createVectorAddRecording = vectorAddLesson.createRecording
