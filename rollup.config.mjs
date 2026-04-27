import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

export default {
  input: "src/index.ts",
  output: [
    {
      file: "dist/scax-engine.js",
      format: "esm",
      sourcemap: true,
    },
    {
      file: "dist/scax-engine.cjs",
      format: "cjs",
      sourcemap: true,
      exports: "named",
    },
    {
      file: "dist/scax-engine.umd.js",
      format: "umd",
      name: "ScaxEngine",
      sourcemap: true,
      exports: "named",
    },
  ],
  plugins: [
    nodeResolve(),
    commonjs(),
    typescript({
      tsconfig: "./tsconfig.json",
      declaration: false,
      sourceMap: true,
    }),
  ],
};
