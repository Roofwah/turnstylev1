import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // mammoth (docx extractor) is a pure Node.js package that uses jszip internally.
  // Declaring it as a server external package prevents Next.js from trying to
  // bundle it through webpack, which would fail in the serverless runtime.
  serverExternalPackages: ["mammoth"],
};

export default nextConfig;
