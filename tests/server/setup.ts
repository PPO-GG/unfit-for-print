// Stub Nitro/H3 globals so server route modules can be imported in unit tests
// without a running Nitro server.

// @ts-ignore
globalThis.defineEventHandler = (fn: unknown) => fn;
// @ts-ignore
globalThis.createError = (opts: { statusCode: number; statusMessage: string }) => {
  const err = new Error(opts.statusMessage);
  (err as any).statusCode = opts.statusCode;
  return err;
};
// @ts-ignore
globalThis.readMultipartFormData = async () => [];
// @ts-ignore
globalThis.assertAdmin = async () => {};
// @ts-ignore
globalThis.useAppwriteAdmin = () => ({});
