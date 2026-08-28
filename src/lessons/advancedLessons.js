import { defineLesson } from './lessonFactory.js'

const VECTOR_A = [1, 2, 3, 4, 5, 6, 7, 8]
const VECTOR_B = [8, 7, 6, 5, 4, 3, 2, 1]
const MATRIX_A = [
  1, 2, 0, 1,
  0, 1, 3, 2,
  2, 0, 1, 1,
  1, 1, 2, 0,
]
const MATRIX_B = [
  1, 0, 2, 1,
  2, 1, 0, 1,
  0, 2, 1, 0,
  1, 1, 0, 2,
]
const CONVOLUTION_INPUT = [1, 2, 4, 7, 6, 3, 2, 1]
const CONVOLUTION_MASK = [1, 0, -1]
const IMAGE_INPUT = [
  1, 2, 3, 4,
  5, 6, 7, 8,
  9, 10, 11, 12,
  13, 14, 15, 16,
]
const EDGE_MASK = [
  0, 1, 0,
  1, -4, 1,
  0, 1, 0,
]
const SORT_INPUT = [7, 2, 6, 3, 8, 1, 5, 4]

const VECTOR_TOPOLOGY = { threadCount: 8 }
const MATRIX_TOPOLOGY = {
  threadCount: 16,
  threadLabel: (index) => `thread (${index % 4}, ${Math.floor(index / 4)})`,
  threadDetail: (index) => `output C[${Math.floor(index / 4)}, ${index % 4}]`,
}

function entryRequirement(pattern, name) {
  return {
    pattern,
    message: `The ${name} lesson entry point was not recognized.`,
    suggestion: 'Restore the sample source and preserve its lesson entry point.',
  }
}

function tokenRequirement(pattern, message, suggestion) {
  return { pattern, message, suggestion }
}

function lessonView({ eyebrow, headline, description, topology, fidelity }) {
  return { eyebrow, headline, description, topology, fidelity }
}

const UNIFIED_VECTOR_SOURCE = `__global__ void managedVectorAdd(float* A, float* B, float* C, int N) {
    int index = blockIdx.x * blockDim.x + threadIdx.x;
    if (index < N) C[index] = A[index] + B[index];
}

int main() {
    const int N = 8;
    float *A, *B, *C;
    cudaMallocManaged(&A, N * sizeof(float));
    cudaMallocManaged(&B, N * sizeof(float));
    cudaMallocManaged(&C, N * sizeof(float));
    managedVectorAdd<<<1, N>>>(A, B, C, N);
    cudaDeviceSynchronize();
    return 0;
}`

export const unifiedVectorAddLesson = defineLesson({
  id: 'vector-add.unified',
  title: 'Unified Memory Vector Addition',
  shortTitle: 'Unified Vector Add',
  category: 'Memory fundamentals',
  description: 'Managed-memory allocation, migration, kernel access, and host readback.',
  filename: 'unified_vector_add.cu',
  source: UNIFIED_VECTOR_SOURCE,
  computeRequest: { operation: 'vector-add', inputs: { a: VECTOR_A, b: VECTOR_B } },
  capabilities: { webGpuValidation: true },
  view: lessonView({
    eyebrow: 'Memory fundamentals · Unified memory',
    headline: 'One allocation, changing ownership',
    description: 'Track managed pages as the host initializes them, the GPU requests them, and the host reads the result.',
    topology: 'Managed pages · 8 GPU lanes · conceptual page migration',
    fidelity: 'Migration model · not hardware page-fault telemetry',
  }),
  analysis: {
    lessonCode: 'UNI',
    requiredPatterns: [
      entryRequirement(/__global__\s+void\s+managedVectorAdd\s*\(/, 'managed vector-add'),
      tokenRequirement(/\bcudaMallocManaged\s*\(/, 'No managed-memory allocation was recognized.', 'Allocate the lesson arrays with cudaMallocManaged.'),
      tokenRequirement(/\bcudaDeviceSynchronize\s*\(/, 'No device synchronization was recognized.', 'Synchronize before the host reads managed output.'),
    ],
    linePatterns: { allocate: /cudaMallocManaged/, migrate: /managedVectorAdd<<</, compute: /C\[index\]/, sync: /cudaDeviceSynchronize/ },
  },
  topology: VECTOR_TOPOLOGY,
  memorySpaces: [
    { id: 'a', label: 'Managed A', kind: 'managed', values: VECTOR_A },
    { id: 'b', label: 'Managed B', kind: 'managed', values: VECTOR_B },
    { id: 'c', label: 'Managed C', kind: 'managed', values: (output) => output },
  ],
  stages: [
    { phase: 'allocate', state: 'idle', sourceKey: 'allocate', title: 'Allocate managed pages', description: 'CUDA creates virtual addresses accessible from both CPU and GPU.', expression: 'cudaMallocManaged(...)', activeMemory: ['a', 'b', 'c'], memoryOperation: { a: 'host-owned', b: 'host-owned', c: 'uninitialized' } },
    { phase: 'migrate', state: 'read', sourceKey: 'migrate', title: 'Migrate input pages to the device', description: 'The first GPU access conceptually faults the required managed pages toward device memory.', expression: 'GPU requests managed page', activeMemory: ['a', 'b'], memoryOperation: { a: 'CPU → GPU', b: 'CPU → GPU' }, insight: 'Real migration granularity and timing depend on the CUDA driver and hardware.' },
    { phase: 'compute', state: 'compute', sourceKey: 'compute', title: 'Execute vector addition', description: 'The kernel uses the same indexing pattern as ordinary device-memory vector addition.', expression: 'C[index] = A[index] + B[index]' },
    { phase: 'synchronize', state: 'write', sourceKey: 'sync', title: 'Finish device writes', description: 'Synchronization establishes that GPU work is complete before host access.', expression: 'cudaDeviceSynchronize()', showResults: true, activeMemory: ['c'], memoryOperation: { c: 'GPU-owned' } },
    { phase: 'host-read', state: 'complete', title: 'Migrate results for host readback', description: 'A later CPU access conceptually moves result pages back toward host memory.', expression: 'host reads C[index]', showResults: true, activeMemory: ['c'], memoryOperation: { c: 'GPU → CPU' } },
  ],
})

const COALESCING_SOURCE = `__global__ void coalescedCopy(const float* input, float* output, int N) {
    int index = blockIdx.x * blockDim.x + threadIdx.x;
    if (index < N) output[index] = input[index];
}

__global__ void stridedCopy(const float* input, float* output, int N, int stride) {
    int index = (blockIdx.x * blockDim.x + threadIdx.x) * stride;
    if (index < N) output[index] = input[index];
}`

export const coalescingLesson = defineLesson({
  id: 'memory.coalescing',
  title: 'Coalesced Memory Access',
  shortTitle: 'Coalescing',
  category: 'Memory fundamentals',
  description: 'Compare adjacent and strided global-memory transactions across warp lanes.',
  filename: 'coalescing.cu',
  source: COALESCING_SOURCE,
  computeRequest: { operation: 'memory-copy', inputs: { values: VECTOR_A } },
  capabilities: { webGpuValidation: false },
  view: lessonView({
    eyebrow: 'Memory fundamentals · Coalescing',
    headline: 'Addresses decide transaction efficiency',
    description: 'Compare eight adjacent lane requests with a strided pattern that touches separated memory segments.',
    topology: '8 lanes · conceptual 32-byte segments · global memory',
    fidelity: 'Transaction model · not hardware counters',
  }),
  analysis: {
    lessonCode: 'COA',
    requiredPatterns: [
      entryRequirement(/__global__\s+void\s+coalescedCopy\s*\(/, 'coalesced-copy'),
      tokenRequirement(/output\s*\[\s*index\s*\]\s*=\s*input\s*\[\s*index\s*\]/, 'No adjacent input/output access was recognized.', 'Keep output[index] = input[index] for the coalesced case.'),
      tokenRequirement(/\*\s*stride/, 'No strided comparison was recognized.', 'Multiply the lane index by stride in the comparison kernel.'),
    ],
    linePatterns: { adjacent: /output\[index\]/, strided: /\*\s*stride/, write: /output\[index\]/ },
  },
  topology: VECTOR_TOPOLOGY,
  memorySpaces: [
    { id: 'input', label: 'Input segments', kind: 'global', values: VECTOR_A },
    { id: 'output', label: 'Copied output', kind: 'global', values: (output) => output },
  ],
  stages: [
    { phase: 'map', state: 'idle', title: 'Map lanes to addresses', description: 'Each lane calculates the address requested by its global index.', expression: 'address = base + index × 4 bytes' },
    { phase: 'coalesced-read', state: 'read', sourceKey: 'adjacent', title: 'Request adjacent elements', description: 'Lane addresses form one contiguous region and can be serviced with few transactions.', expression: 'input[index]', activeMemory: ['input'], memoryOperation: { input: 'adjacent read' }, insight: 'Coalescing describes the relationship between all lane addresses in a warp.' },
    { phase: 'strided-read', state: 'read', sourceKey: 'strided', title: 'Compare a strided pattern', description: 'Separated addresses touch more memory segments even though each lane reads one value.', expression: 'input[index × stride]', activeMemory: ['input'], memoryOperation: { input: 'strided comparison' } },
    { phase: 'write', state: 'write', sourceKey: 'write', title: 'Write the copied output', description: 'The coalesced kernel also writes adjacent output addresses.', expression: 'output[index] = value', showResults: true, activeMemory: ['output'], memoryOperation: { output: 'adjacent write' } },
    { phase: 'complete', state: 'complete', title: 'Compare transaction pressure', description: 'Both patterns can be correct, but the strided pattern requires more conceptual transactions.', expression: 'correctness same; traffic differs', showResults: true },
  ],
})

const TILED_MATMUL_SOURCE = `#define TILE 2
__global__ void blockedMatMul(const float* A, const float* B, float* C, int N) {
    __shared__ float tileA[TILE][TILE];
    __shared__ float tileB[TILE][TILE];
    int row = blockIdx.y * TILE + threadIdx.y;
    int col = blockIdx.x * TILE + threadIdx.x;
    float sum = 0.0f;
    for (int tile = 0; tile < N / TILE; ++tile) {
        tileA[threadIdx.y][threadIdx.x] = A[row * N + tile * TILE + threadIdx.x];
        tileB[threadIdx.y][threadIdx.x] = B[(tile * TILE + threadIdx.y) * N + col];
        __syncthreads();
        for (int k = 0; k < TILE; ++k) sum += tileA[threadIdx.y][k] * tileB[k][threadIdx.x];
        __syncthreads();
    }
    if (row < N && col < N) C[row * N + col] = sum;
}`

export const tiledMatmulLesson = defineLesson({
  id: 'matmul.tiled',
  title: 'Blocked Matrix Multiplication',
  shortTitle: 'Blocked MatMul',
  category: 'Matrix operations',
  description: 'Cooperative block-tile loads, shared-memory reuse, synchronization, and accumulation.',
  filename: 'blocked_matmul.cu',
  source: TILED_MATMUL_SOURCE,
  computeRequest: { operation: 'matrix-multiply', inputs: { a: MATRIX_A, b: MATRIX_B, m: 4, k: 4, n: 4 } },
  capabilities: { webGpuValidation: false },
  view: lessonView({
    eyebrow: 'Matrix operations · Blocked shared-memory tiling',
    headline: 'Load once, reuse across the tile',
    description: 'Watch threads cooperate on global loads, synchronize, and reuse shared-memory operands.',
    topology: 'Grid 2 × 2 · Block 2 × 2 · matrices 4 × 4',
    fidelity: 'Deterministic tile model · no cache timing',
  }),
  analysis: {
    lessonCode: 'TMM',
    requiredPatterns: [
      entryRequirement(/__global__\s+void\s+blockedMatMul\s*\(/, 'blocked matrix-multiplication'),
      tokenRequirement(/__shared__/, 'No shared-memory tile was recognized.', 'Declare tileA and tileB with __shared__.'),
      tokenRequirement(/__syncthreads\s*\(/, 'No block barrier was recognized.', 'Synchronize after cooperative tile loads.'),
    ],
    linePatterns: { index: /int row/, load: /tileA\[/, barrier: /__syncthreads/, compute: /sum \+=/, write: /C\[row/ },
  },
  topology: MATRIX_TOPOLOGY,
  memorySpaces: [
    { id: 'a', label: 'Matrix A', kind: 'global', values: MATRIX_A },
    { id: 'b', label: 'Matrix B', kind: 'global', values: MATRIX_B },
    { id: 'shared-a', label: 'Shared tile A', kind: 'shared', values: MATRIX_A.slice(0, 4) },
    { id: 'shared-b', label: 'Shared tile B', kind: 'shared', values: MATRIX_B.slice(0, 4) },
    { id: 'c', label: 'Matrix C', kind: 'global', values: (output) => output },
  ],
  stages: [
    { phase: 'map', state: 'idle', sourceKey: 'index', title: 'Map blocks to output tiles', description: 'Each 2 × 2 block owns one 2 × 2 region of C.', expression: 'row, col from block + thread' },
    { phase: 'global-load', state: 'read', sourceKey: 'load', title: 'Cooperatively load input tiles', description: 'Each thread contributes one A value and one B value from global memory.', expression: 'global → shared', activeMemory: ['a', 'b'], memoryOperation: { a: 'coalesced read', b: 'coalesced read' } },
    { phase: 'barrier', state: 'read', sourceKey: 'barrier', title: 'Synchronize the block', description: 'No thread may consume the tile before every cooperative load completes.', expression: '__syncthreads()', activeMemory: ['shared-a', 'shared-b'], memoryOperation: { 'shared-a': 'tile ready', 'shared-b': 'tile ready' } },
    { phase: 'reuse', state: 'compute', sourceKey: 'compute', title: 'Reuse shared operands', description: 'Threads repeatedly read the staged tile instead of fetching every operand globally.', expression: 'sum += tileA[row][k] × tileB[k][col]', activeMemory: ['shared-a', 'shared-b'], memoryOperation: { 'shared-a': 'reused read', 'shared-b': 'reused read' }, insight: 'Tiling trades shared-memory capacity and barriers for fewer global-memory reads.' },
    { phase: 'write', state: 'write', sourceKey: 'write', title: 'Write the output tile', description: 'Each thread stores its accumulated scalar to one C element.', expression: 'C[row, col] = sum', showResults: true, activeMemory: ['c'], memoryOperation: { c: 'global write' } },
    { phase: 'complete', state: 'complete', title: 'All tiles complete', description: 'The 4 × 4 result is validated with a CPU matrix multiplication.', expression: 'complete', showResults: true },
  ],
})

const CUBLAS_AXPY_SOURCE = `void runAxpy(cublasHandle_t handle, int N, float alpha,
             const float* x, float* y) {
    cublasSaxpy(handle, N, &alpha, x, 1, y, 1);
}`

export const cublasAxpyLesson = defineLesson({
  id: 'cublas.axpy',
  title: 'cuBLAS Vector Addition (AXPY)',
  shortTitle: 'cuBLAS AXPY',
  category: 'CUDA libraries',
  description: 'Understand the library call, vector operands, scalar alpha, and device result.',
  filename: 'cublas_axpy.cu',
  source: CUBLAS_AXPY_SOURCE,
  computeRequest: { operation: 'axpy', inputs: { alpha: 2, x: VECTOR_A, y: VECTOR_B } },
  capabilities: { webGpuValidation: false },
  view: lessonView({
    eyebrow: 'CUDA libraries · Level-1 BLAS',
    headline: 'Express the operation, delegate the kernel',
    description: 'Decode AXPY parameters and visualize the element-wise work hidden behind the cuBLAS call.',
    topology: 'y ← αx + y · N = 8 · increments 1, 1',
    fidelity: 'API semantics · not a real cuBLAS implementation',
  }),
  analysis: {
    lessonCode: 'AXP',
    requiredPatterns: [
      entryRequirement(/\bcublasSaxpy\s*\(/, 'cuBLAS AXPY'),
      tokenRequirement(/&alpha/, 'The scalar alpha parameter was not recognized.', 'Pass the address of alpha to cublasSaxpy.'),
      tokenRequirement(/x\s*,\s*1\s*,\s*y\s*,\s*1/, 'Unit vector increments were not recognized.', 'Use increment 1 for contiguous x and y vectors.'),
    ],
    linePatterns: { call: /cublasSaxpy/, read: /cublasSaxpy/, compute: /cublasSaxpy/, write: /cublasSaxpy/ },
  },
  topology: VECTOR_TOPOLOGY,
  memorySpaces: [
    { id: 'x', label: 'Device vector x', kind: 'global', values: VECTOR_A },
    { id: 'y', label: 'Device vector y', kind: 'global', values: VECTOR_B },
    { id: 'result', label: 'Updated y', kind: 'global', values: (output) => output },
  ],
  stages: [
    { phase: 'decode', state: 'idle', sourceKey: 'call', title: 'Decode the AXPY call', description: 'cuBLAS receives N, alpha, x, y, and their memory increments.', expression: 'y ← αx + y' },
    { phase: 'dispatch', state: 'read', sourceKey: 'read', title: 'Dispatch an optimized library kernel', description: 'The library chooses its internal launch configuration; application code does not.', expression: 'cuBLAS internal dispatch', activeMemory: ['x', 'y'], memoryOperation: { x: 'read', y: 'read-modify' } },
    { phase: 'compute', state: 'compute', sourceKey: 'compute', title: 'Scale and add each element', description: 'Conceptually, independent lanes calculate alpha × x[index] + y[index].', expression: '2 × x[index] + y[index]' },
    { phase: 'write', state: 'write', sourceKey: 'write', title: 'Update y in place', description: 'AXPY stores the result back into the y vector.', expression: 'y[index] = result', showResults: true, activeMemory: ['result'], memoryOperation: { result: 'in-place write' } },
    { phase: 'complete', state: 'complete', title: 'Library operation complete', description: 'KernelLens validates the AXPY mathematics without claiming to execute cuBLAS.', expression: 'complete', showResults: true },
  ],
})

const CUBLAS_GEMM_SOURCE = `void runGemm(cublasHandle_t handle, const float* A,
             const float* B, float* C, int N) {
    float alpha = 1.0f;
    float beta = 0.0f;
    cublasSgemm(handle, CUBLAS_OP_N, CUBLAS_OP_N,
                N, N, N, &alpha, A, N, B, N, &beta, C, N);
}`

export const cublasGemmLesson = defineLesson({
  id: 'cublas.gemm',
  title: 'cuBLAS Matrix Multiplication (GEMM)',
  shortTitle: 'cuBLAS GEMM',
  category: 'CUDA libraries',
  description: 'Map matrix multiplication to GEMM parameters and column-major storage.',
  filename: 'cublas_gemm.cu',
  source: CUBLAS_GEMM_SOURCE,
  computeRequest: { operation: 'matrix-multiply', inputs: { a: MATRIX_A, b: MATRIX_B, m: 4, k: 4, n: 4 } },
  capabilities: { webGpuValidation: false },
  view: lessonView({
    eyebrow: 'CUDA libraries · Level-3 BLAS',
    headline: 'C ← αAB + βC',
    description: 'Connect GEMM dimensions, transpose flags, scalars, and leading dimensions to matrix multiplication.',
    topology: 'GEMM 4 × 4 × 4 · no-transpose A/B · column-major API',
    fidelity: 'API semantics · CPU mathematical validation',
  }),
  analysis: {
    lessonCode: 'GEM',
    requiredPatterns: [
      entryRequirement(/\bcublasSgemm\s*\(/, 'cuBLAS GEMM'),
      tokenRequirement(/CUBLAS_OP_N/, 'No transpose operation flag was recognized.', 'Specify the operation applied to A and B.'),
      tokenRequirement(/&alpha[\s\S]*&beta/, 'GEMM alpha and beta scalars were not recognized.', 'Pass alpha and beta to define C = alpha AB + beta C.'),
    ],
    linePatterns: { call: /cublasSgemm/, read: /cublasSgemm/, compute: /cublasSgemm/, write: /cublasSgemm/ },
  },
  topology: MATRIX_TOPOLOGY,
  memorySpaces: [
    { id: 'a', label: 'Matrix A', kind: 'global', values: MATRIX_A },
    { id: 'b', label: 'Matrix B', kind: 'global', values: MATRIX_B },
    { id: 'c', label: 'Matrix C', kind: 'global', values: (output) => output },
  ],
  stages: [
    { phase: 'decode', state: 'idle', sourceKey: 'call', title: 'Decode GEMM parameters', description: 'Transpose flags and m, n, k dimensions define the mathematical operation.', expression: 'C ← 1 × A × B + 0 × C' },
    { phase: 'layout', state: 'read', sourceKey: 'read', title: 'Interpret matrix layout', description: 'cuBLAS uses column-major conventions unless application code adapts its operands.', expression: 'leading dimensions describe storage', activeMemory: ['a', 'b'], memoryOperation: { a: 'matrix read', b: 'matrix read' } },
    { phase: 'dispatch', state: 'compute', sourceKey: 'compute', title: 'Dispatch an optimized GEMM kernel', description: 'Real cuBLAS selects architecture-specific tiling and instructions internally.', expression: 'library-selected tiles and pipelines', insight: 'KernelLens illustrates the contract, not proprietary cuBLAS internals.' },
    { phase: 'accumulate', state: 'compute', sourceKey: 'compute', title: 'Accumulate output elements', description: 'Conceptually, each output element is a dot product across the k dimension.', expression: 'C[row,col] += A[row,k] × B[k,col]' },
    { phase: 'write', state: 'write', sourceKey: 'write', title: 'Write matrix C', description: 'The GEMM result replaces C because beta is zero.', expression: 'C = result', showResults: true, activeMemory: ['c'], memoryOperation: { c: 'matrix write' } },
    { phase: 'complete', state: 'complete', title: 'GEMM complete', description: 'The result is checked with the same CPU matrix reference used by tiled matmul.', expression: 'complete', showResults: true },
  ],
})

const REDUCTION_SOURCE = `__global__ void reduceSum(const float* input, float* output, int N) {
    __shared__ float partial[8];
    int lane = threadIdx.x;
    partial[lane] = lane < N ? input[lane] : 0.0f;
    __syncthreads();
    for (int stride = blockDim.x / 2; stride > 0; stride >>= 1) {
        if (lane < stride) partial[lane] += partial[lane + stride];
        __syncthreads();
    }
    if (lane == 0) output[0] = partial[0];
}`

export const reductionLesson = defineLesson({
  id: 'reduction.sum',
  title: 'Sum Reduction Approaches',
  shortTitle: 'Sum Reduction',
  category: 'Collective algorithms',
  description: 'Compare interleaved, sequential, shared-memory, and warp-level reduction stages.',
  filename: 'sum_reduction.cu',
  source: REDUCTION_SOURCE,
  computeRequest: { operation: 'reduction-sum', inputs: { values: VECTOR_A } },
  capabilities: { webGpuValidation: false },
  view: lessonView({
    eyebrow: 'Collectives · Sum reduction',
    headline: 'Many values converge to one',
    description: 'Watch active lanes halve at each tree level while partial sums move through shared memory.',
    topology: '1 block · 8 lanes · 3 tree levels · 1 scalar output',
    fidelity: 'Shared-memory tree · variants explained conceptually',
  }),
  analysis: {
    lessonCode: 'RED',
    requiredPatterns: [
      entryRequirement(/__global__\s+void\s+reduceSum\s*\(/, 'sum-reduction'),
      tokenRequirement(/__shared__/, 'No shared partial-sum array was recognized.', 'Stage block partial sums in shared memory.'),
      tokenRequirement(/stride\s*>>=\s*1/, 'No halving reduction stride was recognized.', 'Halve the active reduction distance each iteration.'),
    ],
    linePatterns: { load: /partial\[lane\] =/, reduce: /partial\[lane\] \+=/, barrier: /__syncthreads/, write: /output\[0\]/ },
  },
  topology: { ...VECTOR_TOPOLOGY, resultIndex: () => 0, resultVisible: (index) => index === 0 },
  memorySpaces: [
    { id: 'input', label: 'Input values', kind: 'global', values: VECTOR_A },
    { id: 'partial', label: 'Shared partial sums', kind: 'shared', values: VECTOR_A },
    { id: 'output', label: 'Reduced scalar', kind: 'global', values: (output) => output },
  ],
  stages: [
    { phase: 'load', state: 'read', sourceKey: 'load', title: 'Load one value per lane', description: 'The block stages input values in low-latency shared memory.', expression: 'partial[lane] = input[lane]', activeMemory: ['input', 'partial'], memoryOperation: { input: 'coalesced read', partial: 'shared write' } },
    { phase: 'stride-4', state: 'compute', sourceKey: 'reduce', title: 'Combine pairs four positions apart', description: 'Four lanes remain active and produce four partial sums.', expression: 'partial[lane] += partial[lane + 4]', activeMemory: ['partial'], memoryOperation: { partial: '4 pair reductions' } },
    { phase: 'stride-2', state: 'compute', sourceKey: 'reduce', title: 'Reduce four partials to two', description: 'Only lanes below the new stride continue participating.', expression: 'partial[lane] += partial[lane + 2]', activeMemory: ['partial'], memoryOperation: { partial: '2 pair reductions' } },
    { phase: 'stride-1', state: 'compute', sourceKey: 'reduce', title: 'Produce the block sum', description: 'Lane zero combines the final two partial values.', expression: 'partial[0] += partial[1]', activeMemory: ['partial'], memoryOperation: { partial: 'final pair' } },
    { phase: 'write', state: 'write', sourceKey: 'write', title: 'Write one scalar', description: 'Lane zero writes the block result to global memory.', expression: 'output[0] = partial[0]', showResults: true, activeMemory: ['output'], memoryOperation: { output: 'single write' } },
    { phase: 'complete', state: 'complete', title: 'Reduction complete', description: 'The CPU reference independently sums all eight inputs.', expression: 'complete', showResults: true },
  ],
})

const BITONIC_SORT_SOURCE = `__global__ void bitonicStep(float* values, int distance, int size, int N) {
    unsigned int index = blockIdx.x * blockDim.x + threadIdx.x;
    unsigned int partner = index ^ distance;

    if (index < N && partner < N && partner > index) {
        bool ascending = (index & size) == 0;
        float left = values[index];
        float right = values[partner];
        if ((ascending && left > right) || (!ascending && left < right)) {
            values[index] = right;
            values[partner] = left;
        }
    }
}

void sortOnGpu(float* values, int N) {
    for (int size = 2; size <= N; size <<= 1) {
        for (int distance = size >> 1; distance > 0; distance >>= 1) {
            bitonicStep<<<1, N>>>(values, distance, size, N);
            cudaDeviceSynchronize();
        }
    }
}`

function createBitonicNetwork(values) {
  const working = [...values]
  const network = []

  for (let size = 2; size <= working.length; size *= 2) {
    for (let distance = size / 2; distance > 0; distance = Math.floor(distance / 2)) {
      for (let index = 0; index < working.length; index += 1) {
        const partner = index ^ distance
        if (partner <= index) continue

        const ascending = (index & size) === 0
        const outOfOrder = ascending
          ? working[index] > working[partner]
          : working[index] < working[partner]

        if (outOfOrder) {
          [working[index], working[partner]] = [working[partner], working[index]]
        }
      }

      network.push({ size, distance, values: [...working] })
    }
  }

  return network
}

const BITONIC_NETWORK = createBitonicNetwork(SORT_INPUT)

export const bitonicSortLesson = defineLesson({
  id: 'sorting.bitonic',
  title: 'Parallel Bitonic Sort',
  shortTitle: 'Bitonic Sort',
  category: 'Parallel sorting',
  description: 'Compare and exchange values through a deterministic sorting network.',
  filename: 'bitonic_sort.cu',
  source: BITONIC_SORT_SOURCE,
  computeRequest: { operation: 'bitonic-sort', inputs: { values: SORT_INPUT } },
  capabilities: { webGpuValidation: false },
  view: lessonView({
    eyebrow: 'Parallel sorting · Bitonic network',
    headline: 'Global order from local compare–exchange pairs',
    description: 'Follow partner lanes as increasing subsequences merge into one ascending sequence.',
    topology: '1 block · 8 lanes · 6 compare–exchange stages',
    fidelity: 'Exact sorting network · synchronization timing is conceptual',
  }),
  analysis: {
    lessonCode: 'BIT',
    requiredPatterns: [
      entryRequirement(/__global__\s+void\s+bitonicStep\s*\(/, 'bitonic-sort'),
      tokenRequirement(/\^\s*distance/, 'No XOR partner calculation was recognized.', 'Pair each lane with index ^ distance.'),
      tokenRequirement(/size\s*<<=\s*1/, 'No growing bitonic sequence was recognized.', 'Double the merge size after each network level.'),
      tokenRequirement(/distance\s*>>=\s*1/, 'No shrinking compare distance was recognized.', 'Halve the partner distance within each merge level.'),
    ],
    linePatterns: { index: /unsigned int index/, partner: /index \^ distance/, compare: /ascending && left > right/, launch: /bitonicStep<<</ },
  },
  topology: {
    ...VECTOR_TOPOLOGY,
    threadLabel: (index) => `lane ${index}`,
    threadDetail: (index) => `network element [${index}]`,
  },
  memorySpaces: [
    { id: 'input', label: 'Unsorted global input', kind: 'global', values: SORT_INPUT },
    { id: 'network', label: 'Compare–exchange working set', kind: 'shared', values: SORT_INPUT },
    { id: 'output', label: 'Sorted global output', kind: 'global', values: (output) => output },
  ],
  stages: [
    { phase: 'map', state: 'idle', sourceKey: 'index', title: 'Map lanes to array elements', description: 'Every logical lane owns one element and calculates partners with XOR.', expression: 'index = global lane' },
    { phase: 'load', state: 'read', sourceKey: 'index', title: 'Load the sorting network input', description: 'Eight values enter a power-of-two sorting network.', expression: 'working[index] = values[index]', activeMemory: ['input', 'network'], memoryOperation: { input: 'coalesced read', network: 'stage values' }, memoryValues: { network: SORT_INPUT } },
    ...BITONIC_NETWORK.map((step, stageIndex) => ({
      phase: 'compare-exchange',
      state: 'compute',
      sourceKey: 'compare',
      title: `Compare–exchange stage ${stageIndex + 1} of ${BITONIC_NETWORK.length}`,
      description: `Lanes compare XOR partners ${step.distance} position${step.distance === 1 ? '' : 's'} away inside sequences of ${step.size}.`,
      insight: stageIndex === 0 ? 'Bitonic sort performs a fixed comparison network, so its control flow does not depend on the input values.' : null,
      threadExpression: (index) => {
        const partner = index ^ step.distance
        const direction = (index & step.size) === 0 ? 'ascending' : 'descending'
        return partner > index ? `compare lane ${partner} · ${direction}` : `paired with lane ${partner}`
      },
      activeMemory: ['network'],
      memoryOperation: { network: `distance ${step.distance} compare–swap` },
      memoryValues: { network: step.values },
    })),
    { phase: 'write', state: 'write', sourceKey: 'launch', title: 'Publish the ascending sequence', description: 'After six deterministic stages, every element is globally ordered.', expression: 'output[index] = sorted value', showResults: true, activeMemory: ['output'], memoryOperation: { output: 'coalesced write' } },
    { phase: 'complete', state: 'complete', title: 'Parallel sort complete', description: 'The final sequence is independently checked by the CPU reference backend.', expression: 'ascending order', showResults: true, activeMemory: ['output'], memoryOperation: { output: 'validated' } },
  ],
})

function createConvolutionLesson({ id, title, shortTitle, description, filename, source, lessonCode, requiredPatterns, memorySpaces, stages, view }) {
  return defineLesson({
    id,
    title,
    shortTitle,
    category: 'Convolution',
    description,
    filename,
    source,
    computeRequest: { operation: 'convolution-1d', inputs: { input: CONVOLUTION_INPUT, mask: CONVOLUTION_MASK } },
    capabilities: { webGpuValidation: false },
    view,
    analysis: {
      lessonCode,
      requiredPatterns,
      linePatterns: { index: /int index/, load: /input\[/, compute: /sum \+=/, write: /output\[index\]/ },
    },
    topology: VECTOR_TOPOLOGY,
    memorySpaces,
    stages,
  })
}

const NAIVE_CONV_SOURCE = `__global__ void convolution1D(const float* input, const float* mask,
                              float* output, int N, int maskWidth) {
    int index = blockIdx.x * blockDim.x + threadIdx.x;
    float sum = 0.0f;
    int radius = maskWidth / 2;
    for (int j = 0; j < maskWidth; ++j) {
        int inputIndex = index + j - radius;
        if (inputIndex >= 0 && inputIndex < N)
            sum += input[inputIndex] * mask[j];
    }
    if (index < N) output[index] = sum;
}`

const GLOBAL_CONV_MEMORY = [
  { id: 'input', label: 'Input signal', kind: 'global', values: CONVOLUTION_INPUT },
  { id: 'mask', label: 'Filter mask', kind: 'global', values: CONVOLUTION_MASK },
  { id: 'output', label: 'Output signal', kind: 'global', values: (output) => output },
]

export const naiveConvolution1dLesson = createConvolutionLesson({
  id: 'convolution-1d.naive',
  title: 'Naïve 1-D Convolution',
  shortTitle: 'Naïve 1-D Conv',
  description: 'One output thread repeatedly reads input and mask values from global memory.',
  filename: 'naive_convolution_1d.cu',
  source: NAIVE_CONV_SOURCE,
  lessonCode: 'C1N',
  requiredPatterns: [entryRequirement(/__global__\s+void\s+convolution1D\s*\(/, '1-D convolution'), tokenRequirement(/sum\s*\+=\s*input\[/, 'No convolution accumulation was recognized.', 'Multiply an input neighborhood by the mask.')],
  memorySpaces: GLOBAL_CONV_MEMORY,
  view: lessonView({ eyebrow: 'Convolution · Naïve 1-D', headline: 'One neighborhood per output lane', description: 'Each lane walks its input neighborhood and repeatedly reads the global mask.', topology: '8 lanes · mask width 3 · zero-padded boundaries', fidelity: 'Exact small-input arithmetic · conceptual cache behavior' }),
  stages: [
    { phase: 'map', state: 'idle', sourceKey: 'index', title: 'Assign one output per lane', description: 'Each lane owns one center position in the output signal.', expression: 'index = global lane' },
    { phase: 'neighborhood', state: 'read', sourceKey: 'load', title: 'Read the input neighborhood', description: 'Neighboring lanes request overlapping input windows from global memory.', expression: 'input[index + j - radius]', activeMemory: ['input'], memoryOperation: { input: 'overlapping reads' } },
    { phase: 'mask', state: 'read', sourceKey: 'load', title: 'Read mask coefficients', description: 'Every lane requests the same three read-only mask values.', expression: 'mask[j]', activeMemory: ['mask'], memoryOperation: { mask: 'repeated global reads' } },
    { phase: 'compute', state: 'compute', sourceKey: 'compute', title: 'Accumulate products', description: 'Each lane calculates a dot product between its neighborhood and the mask.', expression: 'sum += input × mask' },
    { phase: 'write', state: 'write', sourceKey: 'write', title: 'Write filtered output', description: 'Each active lane writes one output sample.', expression: 'output[index] = sum', showResults: true, activeMemory: ['output'], memoryOperation: { output: 'coalesced write' } },
    { phase: 'complete', state: 'complete', title: 'Convolution complete', description: 'Boundary samples used zero padding in the CPU reference.', expression: 'complete', showResults: true },
  ],
})

const CONSTANT_CONV_SOURCE = `__constant__ float constantMask[3];
__global__ void constantConvolution1D(const float* input, float* output, int N) {
    int index = blockIdx.x * blockDim.x + threadIdx.x;
    float sum = 0.0f;
    for (int j = 0; j < 3; ++j) {
        int inputIndex = index + j - 1;
        if (inputIndex >= 0 && inputIndex < N)
            sum += input[inputIndex] * constantMask[j];
    }
    if (index < N) output[index] = sum;
}`

export const constantConvolution1dLesson = createConvolutionLesson({
  id: 'convolution-1d.constant', title: '1-D Convolution with Constant Memory', shortTitle: 'Constant 1-D Conv', description: 'Broadcast a read-only convolution mask from the constant-memory cache.', filename: 'constant_convolution_1d.cu', source: CONSTANT_CONV_SOURCE, lessonCode: 'C1C',
  requiredPatterns: [entryRequirement(/__global__\s+void\s+constantConvolution1D\s*\(/, 'constant-memory convolution'), tokenRequirement(/__constant__/, 'No constant-memory mask was recognized.', 'Declare the shared read-only mask with __constant__.')],
  memorySpaces: [{ id: 'input', label: 'Input signal', kind: 'global', values: CONVOLUTION_INPUT }, { id: 'mask', label: 'Broadcast mask', kind: 'constant', values: CONVOLUTION_MASK }, { id: 'output', label: 'Output signal', kind: 'global', values: (output) => output }],
  view: lessonView({ eyebrow: 'Convolution · Constant memory', headline: 'One coefficient broadcast to many lanes', description: 'The warp requests a shared mask address while lanes read different input neighborhoods.', topology: '8 lanes · 3 constant coefficients · zero padding', fidelity: 'Broadcast model · not cache-hit telemetry' }),
  stages: [
    { phase: 'map', state: 'idle', sourceKey: 'index', title: 'Assign output positions', description: 'Each lane owns one output sample.', expression: 'index = global lane' },
    { phase: 'input-read', state: 'read', sourceKey: 'load', title: 'Read overlapping input windows', description: 'Input samples still come from global memory.', expression: 'input[inputIndex]', activeMemory: ['input'], memoryOperation: { input: 'overlapping reads' } },
    { phase: 'broadcast', state: 'read', sourceKey: 'load', title: 'Broadcast mask coefficients', description: 'Lanes request the same constant address for each loop iteration.', expression: 'constantMask[j]', activeMemory: ['mask'], memoryOperation: { mask: 'warp broadcast' }, insight: 'Constant memory is most effective when lanes request the same address.' },
    { phase: 'compute', state: 'compute', sourceKey: 'compute', title: 'Accumulate products', description: 'Arithmetic is unchanged; only the mask delivery path differs.', expression: 'sum += input × constantMask' },
    { phase: 'write', state: 'write', sourceKey: 'write', title: 'Write output samples', description: 'Each lane writes one filtered result.', expression: 'output[index] = sum', showResults: true, activeMemory: ['output'], memoryOperation: { output: 'coalesced write' } },
    { phase: 'complete', state: 'complete', title: 'Constant-memory lesson complete', description: 'The numerical result matches naïve convolution.', expression: 'complete', showResults: true },
  ],
})

const TILED_CONV_SOURCE = `#define BLOCK_SIZE 8
__global__ void tiledConvolution1D(const float* input, const float* mask,
                                   float* output, int N) {
    __shared__ float tile[BLOCK_SIZE + 2];
    int index = blockIdx.x * blockDim.x + threadIdx.x;
    tile[threadIdx.x + 1] = index < N ? input[index] : 0.0f;
    if (threadIdx.x == 0) tile[0] = index > 0 ? input[index - 1] : 0.0f;
    __syncthreads();
    float sum = 0.0f;
    for (int j = 0; j < 3; ++j) sum += tile[threadIdx.x + j] * mask[j];
    if (index < N) output[index] = sum;
}`

export const tiledConvolution1dLesson = createConvolutionLesson({
  id: 'convolution-1d.tiled', title: 'Tiled 1-D Convolution', shortTitle: 'Tiled 1-D Conv', description: 'Cooperatively stage input elements and halos in shared memory.', filename: 'tiled_convolution_1d.cu', source: TILED_CONV_SOURCE, lessonCode: 'C1T',
  requiredPatterns: [entryRequirement(/__global__\s+void\s+tiledConvolution1D\s*\(/, 'tiled convolution'), tokenRequirement(/__shared__/, 'No shared input tile was recognized.', 'Stage input and halo values in __shared__ memory.'), tokenRequirement(/__syncthreads/, 'No tile-load barrier was recognized.', 'Synchronize before reading the shared tile.')],
  memorySpaces: [{ id: 'input', label: 'Input signal', kind: 'global', values: CONVOLUTION_INPUT }, { id: 'tile', label: 'Input + halo tile', kind: 'shared', values: [0, ...CONVOLUTION_INPUT, 0] }, { id: 'mask', label: 'Mask', kind: 'global', values: CONVOLUTION_MASK }, { id: 'output', label: 'Output signal', kind: 'global', values: (output) => output }],
  view: lessonView({ eyebrow: 'Convolution · Shared-memory tiling', headline: 'Cooperate on the overlapping input window', description: 'A block stages its core samples and halo once, then lanes reuse shared values.', topology: '1 block · 8 lanes · 2 halo values · mask width 3', fidelity: 'Deterministic tile model · no bank-conflict timing' }),
  stages: [
    { phase: 'map', state: 'idle', sourceKey: 'index', title: 'Map the output tile', description: 'Eight lanes own eight adjacent output samples.', expression: 'index = global lane' },
    { phase: 'tile-load', state: 'read', sourceKey: 'load', title: 'Load core samples cooperatively', description: 'Each lane transfers one input sample into shared memory.', expression: 'tile[lane + 1] = input[index]', activeMemory: ['input', 'tile'], memoryOperation: { input: 'coalesced read', tile: 'shared write' } },
    { phase: 'halo-load', state: 'read', sourceKey: 'load', title: 'Load boundary halos', description: 'Selected lanes fetch the neighboring samples required by the tile.', expression: 'load left/right halo', activeMemory: ['input', 'tile'], memoryOperation: { input: 'halo read', tile: 'halo write' } },
    { phase: 'barrier', state: 'read', sourceKey: 'load', title: 'Synchronize the shared tile', description: 'The barrier makes core and halo values visible to every lane.', expression: '__syncthreads()', activeMemory: ['tile'], memoryOperation: { tile: 'tile ready' } },
    { phase: 'compute', state: 'compute', sourceKey: 'compute', title: 'Reuse shared neighborhoods', description: 'Overlapping windows now reuse values already present in shared memory.', expression: 'sum += tile[lane + j] × mask[j]', activeMemory: ['tile', 'mask'], memoryOperation: { tile: 'reused read', mask: 'read' } },
    { phase: 'write', state: 'write', sourceKey: 'write', title: 'Write filtered output', description: 'Each lane writes one sample.', expression: 'output[index] = sum', showResults: true, activeMemory: ['output'], memoryOperation: { output: 'coalesced write' } },
    { phase: 'complete', state: 'complete', title: 'Tiled convolution complete', description: 'The result matches the naïve algorithm with fewer conceptual global input reads.', expression: 'complete', showResults: true },
  ],
})

const CACHE_CONV_SOURCE = `__global__ void cachedConvolution1D(const float* __restrict__ input,
                                    const float* __restrict__ mask,
                                    float* output, int N) {
    int index = blockIdx.x * blockDim.x + threadIdx.x;
    float sum = 0.0f;
    #pragma unroll
    for (int j = 0; j < 3; ++j) {
        int inputIndex = index + j - 1;
        if (inputIndex >= 0 && inputIndex < N)
            sum += __ldg(&input[inputIndex]) * __ldg(&mask[j]);
    }
    if (index < N) output[index] = sum;
}`

export const cachedConvolution1dLesson = createConvolutionLesson({
  id: 'convolution-1d.cache', title: '1-D Convolution Cache Simplification', shortTitle: 'Cached 1-D Conv', description: 'Rely on read-only cache reuse while simplifying explicit halo staging.', filename: 'cached_convolution_1d.cu', source: CACHE_CONV_SOURCE, lessonCode: 'C1R',
  requiredPatterns: [entryRequirement(/__global__\s+void\s+cachedConvolution1D\s*\(/, 'cache-simplified convolution'), tokenRequirement(/__restrict__|__ldg/, 'No read-only cache hint was recognized.', 'Preserve __restrict__ or __ldg in this educational cache lesson.')],
  memorySpaces: [{ id: 'input', label: 'Read-only input', kind: 'global-cache', values: CONVOLUTION_INPUT }, { id: 'mask', label: 'Read-only mask', kind: 'global-cache', values: CONVOLUTION_MASK }, { id: 'output', label: 'Output signal', kind: 'global', values: (output) => output }],
  view: lessonView({ eyebrow: 'Convolution · Cache simplification', headline: 'Trade explicit staging for cache-managed reuse', description: 'Keep the kernel simple and let read-only caches capture repeated neighborhood and mask accesses.', topology: '8 lanes · overlapping reads · implementation-managed cache', fidelity: 'Reuse model · cache hits are not measured' }),
  stages: [
    { phase: 'map', state: 'idle', sourceKey: 'index', title: 'Assign output samples', description: 'The thread-to-output mapping stays unchanged.', expression: 'index = global lane' },
    { phase: 'first-read', state: 'read', sourceKey: 'load', title: 'Issue initial read-only loads', description: 'The first neighborhood accesses populate conceptual cache lines.', expression: '__ldg(input + inputIndex)', activeMemory: ['input', 'mask'], memoryOperation: { input: 'cache fill', mask: 'cache fill' } },
    { phase: 'reuse', state: 'read', sourceKey: 'load', title: 'Reuse overlapping cache lines', description: 'Neighboring lanes request values that may already reside in the read-only cache.', expression: 'cached overlapping read', activeMemory: ['input', 'mask'], memoryOperation: { input: 'conceptual hit', mask: 'conceptual hit' }, insight: 'Actual hit rates depend on architecture, cache state, and competing traffic.' },
    { phase: 'compute', state: 'compute', sourceKey: 'compute', title: 'Accumulate the same convolution', description: 'The optimization changes data delivery, not the mathematical result.', expression: 'sum += input × mask' },
    { phase: 'write', state: 'write', sourceKey: 'write', title: 'Write output samples', description: 'Output writes remain coalesced.', expression: 'output[index] = sum', showResults: true, activeMemory: ['output'], memoryOperation: { output: 'coalesced write' } },
    { phase: 'complete', state: 'complete', title: 'Cache lesson complete', description: 'Compare code simplicity with the explicit shared-memory tiled version.', expression: 'complete', showResults: true },
  ],
})

const CONVOLUTION_2D_SOURCE = `__global__ void convolution2D(const float* input, const float* mask,
                              float* output, int width, int height) {
    int col = blockIdx.x * blockDim.x + threadIdx.x;
    int row = blockIdx.y * blockDim.y + threadIdx.y;
    if (row >= height || col >= width) return;
    float sum = 0.0f;
    for (int maskRow = 0; maskRow < 3; ++maskRow)
        for (int maskCol = 0; maskCol < 3; ++maskCol) {
            int imageRow = row + maskRow - 1;
            int imageCol = col + maskCol - 1;
            if (imageRow >= 0 && imageRow < height && imageCol >= 0 && imageCol < width)
                sum += input[imageRow * width + imageCol] * mask[maskRow * 3 + maskCol];
        }
    output[row * width + col] = sum;
}`

export const convolution2dLesson = defineLesson({
  id: 'convolution-2d.naive',
  title: 'Naïve 2-D Convolution',
  shortTitle: '2-D Convolution',
  category: 'Convolution',
  description: 'Map a two-dimensional thread grid onto image pixels and filter neighborhoods.',
  filename: 'convolution_2d.cu',
  source: CONVOLUTION_2D_SOURCE,
  computeRequest: { operation: 'convolution-2d', inputs: { input: IMAGE_INPUT, width: 4, height: 4, mask: EDGE_MASK, maskWidth: 3 } },
  capabilities: { webGpuValidation: false },
  view: lessonView({ eyebrow: 'Convolution · 2-D image grid', headline: 'One thread owns one output pixel', description: 'Translate a 2-D block/thread coordinate into a pixel and walk its 3 × 3 neighborhood.', topology: 'Image 4 × 4 · 16 logical threads · filter 3 × 3', fidelity: 'Exact small-image arithmetic · zero-padded boundaries' }),
  analysis: {
    lessonCode: 'C2D',
    requiredPatterns: [entryRequirement(/__global__\s+void\s+convolution2D\s*\(/, '2-D convolution'), tokenRequirement(/blockIdx\.y[\s\S]*threadIdx\.y/, 'No two-dimensional row mapping was recognized.', 'Compute row from blockIdx.y and threadIdx.y.'), tokenRequirement(/maskRow[\s\S]*maskCol/, 'No two-dimensional mask traversal was recognized.', 'Iterate across mask rows and columns.')],
    linePatterns: { index: /int col/, load: /input\[imageRow/, compute: /sum \+=/, write: /output\[row/ },
  },
  topology: MATRIX_TOPOLOGY,
  memorySpaces: [
    { id: 'image', label: 'Input image 4 × 4', kind: 'global', values: IMAGE_INPUT },
    { id: 'mask', label: 'Edge filter 3 × 3', kind: 'constant', values: EDGE_MASK },
    { id: 'output', label: 'Filtered image 4 × 4', kind: 'global', values: (output) => output },
  ],
  stages: [
    { phase: 'map', state: 'idle', sourceKey: 'index', title: 'Map threads to pixels', description: 'The x dimension selects a column and y selects a row.', expression: 'pixel = (row, col)' },
    { phase: 'bounds', state: 'read', sourceKey: 'index', title: 'Clip the image boundary', description: 'Threads exclude neighbors that fall outside the image.', expression: '0 ≤ imageRow/Col < extent' },
    { phase: 'neighborhood', state: 'read', sourceKey: 'load', title: 'Read each 3 × 3 neighborhood', description: 'Adjacent pixels use strongly overlapping input regions.', expression: 'input[imageRow, imageCol]', activeMemory: ['image', 'mask'], memoryOperation: { image: 'overlapping 2-D reads', mask: 'broadcast coefficients' } },
    { phase: 'compute', state: 'compute', sourceKey: 'compute', title: 'Accumulate nine products', description: 'Each thread computes a two-dimensional dot product.', expression: 'sum += image × mask' },
    { phase: 'write', state: 'write', sourceKey: 'write', title: 'Write the filtered pixel', description: 'Each active thread writes one output coordinate.', expression: 'output[row, col] = sum', showResults: true, activeMemory: ['output'], memoryOperation: { output: '2-D row-major write' } },
    { phase: 'complete', state: 'complete', title: '2-D convolution complete', description: 'The filtered 4 × 4 image is checked by a CPU reference.', expression: 'complete', showResults: true },
  ],
})

export const advancedLessons = [
  unifiedVectorAddLesson,
  coalescingLesson,
  tiledMatmulLesson,
  cublasAxpyLesson,
  cublasGemmLesson,
  reductionLesson,
  bitonicSortLesson,
  naiveConvolution1dLesson,
  constantConvolution1dLesson,
  tiledConvolution1dLesson,
  cachedConvolution1dLesson,
  convolution2dLesson,
]
