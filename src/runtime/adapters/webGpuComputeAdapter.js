const VECTOR_ADD_SHADER = `
@group(0) @binding(0) var<storage, read> inputA: array<f32>;
@group(0) @binding(1) var<storage, read> inputB: array<f32>;
@group(0) @binding(2) var<storage, read_write> output: array<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
  let index = globalId.x;

  if (index >= arrayLength(&output)) {
    return;
  }

  output[index] = inputA[index] + inputB[index];
}
`

function destroyBuffers(buffers) {
  buffers.forEach((buffer) => buffer?.destroy())
}

export function createWebGpuComputeAdapter({
  gpu = globalThis.navigator?.gpu,
  bufferUsage = globalThis.GPUBufferUsage,
  mapMode = globalThis.GPUMapMode,
} = {}) {
  return {
    id: 'webgpu',

    async isAvailable() {
      return Boolean(gpu?.requestAdapter && bufferUsage && mapMode)
    },

    async execute(request) {
      if (request.operation !== 'vector-add') {
        throw new Error(`WebGPU does not support '${request.operation}'.`)
      }

      if (!await this.isAvailable()) {
        throw new Error('WebGPU is not available in this browser.')
      }

      const gpuAdapter = await gpu.requestAdapter()
      if (!gpuAdapter) throw new Error('The browser could not acquire a WebGPU adapter.')

      const device = await gpuAdapter.requestDevice()
      const inputA = new Float32Array(request.inputs.a)
      const inputB = new Float32Array(request.inputs.b)
      const byteLength = inputA.byteLength
      const buffers = []

      try {
        const inputABuffer = device.createBuffer({
          label: 'vector-add-input-a',
          size: byteLength,
          usage: bufferUsage.STORAGE | bufferUsage.COPY_DST,
        })
        const inputBBuffer = device.createBuffer({
          label: 'vector-add-input-b',
          size: byteLength,
          usage: bufferUsage.STORAGE | bufferUsage.COPY_DST,
        })
        const outputBuffer = device.createBuffer({
          label: 'vector-add-output',
          size: byteLength,
          usage: bufferUsage.STORAGE | bufferUsage.COPY_SRC,
        })
        const readbackBuffer = device.createBuffer({
          label: 'vector-add-readback',
          size: byteLength,
          usage: bufferUsage.COPY_DST | bufferUsage.MAP_READ,
        })
        buffers.push(inputABuffer, inputBBuffer, outputBuffer, readbackBuffer)

        device.queue.writeBuffer(inputABuffer, 0, inputA)
        device.queue.writeBuffer(inputBBuffer, 0, inputB)

        const shaderModule = device.createShaderModule({
          label: 'vector-add-shader',
          code: VECTOR_ADD_SHADER,
        })
        const pipeline = device.createComputePipeline({
          label: 'vector-add-pipeline',
          layout: 'auto',
          compute: { module: shaderModule, entryPoint: 'main' },
        })
        const bindGroup = device.createBindGroup({
          label: 'vector-add-bind-group',
          layout: pipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: inputABuffer } },
            { binding: 1, resource: { buffer: inputBBuffer } },
            { binding: 2, resource: { buffer: outputBuffer } },
          ],
        })

        const commandEncoder = device.createCommandEncoder({ label: 'vector-add-commands' })
        const computePass = commandEncoder.beginComputePass()
        computePass.setPipeline(pipeline)
        computePass.setBindGroup(0, bindGroup)
        computePass.dispatchWorkgroups(Math.ceil(inputA.length / 64))
        computePass.end()
        commandEncoder.copyBufferToBuffer(outputBuffer, 0, readbackBuffer, 0, byteLength)
        device.queue.submit([commandEncoder.finish()])

        await readbackBuffer.mapAsync(mapMode.READ)
        const output = Array.from(new Float32Array(readbackBuffer.getMappedRange().slice(0)))
        readbackBuffer.unmap()

        return { backend: this.id, output }
      } finally {
        destroyBuffers(buffers)
        device.destroy?.()
      }
    },
  }
}
