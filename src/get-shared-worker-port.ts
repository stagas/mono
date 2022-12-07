export const getSharedWorkerPort = () => {
  const worker = new SharedWorker(
    // @ts-ignore
    new URL('linker-worker.js', import.meta.url),
    {
      type: 'module',
    }
  )

  return worker.port
}
