// server/utils/json-bigint-shim.mjs
// Shim for json-bigint that uses native JSON on Cloudflare Workers.
// The node-appwrite SDK uses json-bigint for BigNumber handling, but
// json-bigint's `str()` function does `value instanceof BigNumber`
// which fails in the workerd runtime (CJS/ESM module boundary split).
// Since we don't use BigInt/BigNumber values in our Appwrite data,
// native JSON is perfectly safe.

const noop = () => ({
  parse: JSON.parse,
  stringify: JSON.stringify,
});

// json-bigint is called as a factory: const JSONbig = JSONbigint({ ... })
export default noop;
export { noop };
