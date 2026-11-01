/** @type {import('next').NextConfig} */
const nextConfig = {
  // Native/ONNX packages must stay outside the server bundle
  serverExternalPackages: ['@xenova/transformers', 'onnxruntime-node', 'sharp'],
};
export default nextConfig;
