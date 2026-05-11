// tsup.config.ts
import { sentryEsbuildPlugin } from "@sentry/esbuild-plugin";
import { defineConfig } from "tsup";
var tsup_config_default = defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  minify: false,
  splitting: false,
  bundle: true,
  // NÃO fazer bundle de nada de node_modules, apenas código interno
  external: [/node_modules/],
  platform: "node",
  tsconfig: "./tsconfig.json",
  esbuildPlugins: [
    // Upload de sourcemaps para o Sentry no build
    // Requer SENTRY_AUTH_TOKEN no ambiente (CI ou local)
    ...process.env.SENTRY_AUTH_TOKEN ? [
      sentryEsbuildPlugin({
        org: process.env.SENTRY_ORG || "ze-filho",
        project: process.env.SENTRY_PROJECT || "node-hono",
        authToken: process.env.SENTRY_AUTH_TOKEN,
        release: {
          name: `nexo-api@${process.env.npm_package_version || "0.0.0"}`
        },
        sourcemaps: {
          assets: "./dist/**"
        },
        telemetry: false
      })
    ] : []
  ],
  onSuccess: async () => {
    const { cpSync, existsSync } = await import("node:fs");
    const { join } = await import("node:path");
    const templatesSource = join("src", "templates");
    const templatesDest = join("dist", "templates");
    const nlpModelSource = join("src", "services", "message-analysis", "training", "model");
    const nlpModelDest = join("dist", "model");
    const promptsSource = join("src", "config", "prompts");
    const promptsDest = join("dist", "config", "prompts");
    if (existsSync(templatesSource)) {
      cpSync(templatesSource, templatesDest, { recursive: true });
      console.log("\u2713 Templates copiados para dist/templates");
    } else {
      console.warn("\u26A0 Pasta templates n\xE3o encontrada em", templatesSource);
    }
    if (existsSync(nlpModelSource)) {
      cpSync(nlpModelSource, nlpModelDest, { recursive: true });
      console.log("\u2713 Modelo NLP copiado para dist/model");
    } else {
      console.warn("\u26A0 Pasta do modelo NLP n\xE3o encontrada em", nlpModelSource);
    }
    if (existsSync(promptsSource)) {
      cpSync(promptsSource, promptsDest, { recursive: true });
      const promptsPath = `dist/${["config", "prompts"].join("/")}`;
      console.log(`\u2713 Prompts YAML copiados para ${promptsPath}`);
    } else {
      console.warn("\u26A0 Pasta de prompts YAML n\xE3o encontrada em", promptsSource);
    }
  }
});
export {
  tsup_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidHN1cC5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL2hvbWUvcHNvdXNhai9wcm9qZWN0cy9uZXhvLWFpL2FwcHMvYXBpL3RzdXAuY29uZmlnLnRzXCI7Y29uc3QgX19pbmplY3RlZF9kaXJuYW1lX18gPSBcIi9ob21lL3Bzb3VzYWovcHJvamVjdHMvbmV4by1haS9hcHBzL2FwaVwiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vaG9tZS9wc291c2FqL3Byb2plY3RzL25leG8tYWkvYXBwcy9hcGkvdHN1cC5jb25maWcudHNcIjtpbXBvcnQgeyBzZW50cnlFc2J1aWxkUGx1Z2luIH0gZnJvbSAnQHNlbnRyeS9lc2J1aWxkLXBsdWdpbic7XG5pbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd0c3VwJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcblx0ZW50cnk6IFsnc3JjL2luZGV4LnRzJ10sXG5cdGZvcm1hdDogWydlc20nXSxcblx0dGFyZ2V0OiAnbm9kZTIwJyxcblx0b3V0RGlyOiAnZGlzdCcsXG5cdGNsZWFuOiB0cnVlLFxuXHRzb3VyY2VtYXA6IHRydWUsXG5cdG1pbmlmeTogZmFsc2UsXG5cdHNwbGl0dGluZzogZmFsc2UsXG5cdGJ1bmRsZTogdHJ1ZSxcblx0Ly8gTlx1MDBDM08gZmF6ZXIgYnVuZGxlIGRlIG5hZGEgZGUgbm9kZV9tb2R1bGVzLCBhcGVuYXMgY1x1MDBGM2RpZ28gaW50ZXJub1xuXHRleHRlcm5hbDogWy9ub2RlX21vZHVsZXMvXSxcblx0cGxhdGZvcm06ICdub2RlJyxcblx0dHNjb25maWc6ICcuL3RzY29uZmlnLmpzb24nLFxuXHRlc2J1aWxkUGx1Z2luczogW1xuXHRcdC8vIFVwbG9hZCBkZSBzb3VyY2VtYXBzIHBhcmEgbyBTZW50cnkgbm8gYnVpbGRcblx0XHQvLyBSZXF1ZXIgU0VOVFJZX0FVVEhfVE9LRU4gbm8gYW1iaWVudGUgKENJIG91IGxvY2FsKVxuXHRcdC4uLihwcm9jZXNzLmVudi5TRU5UUllfQVVUSF9UT0tFTlxuXHRcdFx0PyBbXG5cdFx0XHRcdFx0c2VudHJ5RXNidWlsZFBsdWdpbih7XG5cdFx0XHRcdFx0XHRvcmc6IHByb2Nlc3MuZW52LlNFTlRSWV9PUkcgfHwgJ3plLWZpbGhvJyxcblx0XHRcdFx0XHRcdHByb2plY3Q6IHByb2Nlc3MuZW52LlNFTlRSWV9QUk9KRUNUIHx8ICdub2RlLWhvbm8nLFxuXHRcdFx0XHRcdFx0YXV0aFRva2VuOiBwcm9jZXNzLmVudi5TRU5UUllfQVVUSF9UT0tFTixcblx0XHRcdFx0XHRcdHJlbGVhc2U6IHtcblx0XHRcdFx0XHRcdFx0bmFtZTogYG5leG8tYXBpQCR7cHJvY2Vzcy5lbnYubnBtX3BhY2thZ2VfdmVyc2lvbiB8fCAnMC4wLjAnfWAsXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0c291cmNlbWFwczoge1xuXHRcdFx0XHRcdFx0XHRhc3NldHM6ICcuL2Rpc3QvKionLFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdHRlbGVtZXRyeTogZmFsc2UsXG5cdFx0XHRcdFx0fSksXG5cdFx0XHRcdF1cblx0XHRcdDogW10pLFxuXHRdLFxuXHRvblN1Y2Nlc3M6IGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB7IGNwU3luYywgZXhpc3RzU3luYyB9ID0gYXdhaXQgaW1wb3J0KCdub2RlOmZzJyk7XG5cdFx0Y29uc3QgeyBqb2luIH0gPSBhd2FpdCBpbXBvcnQoJ25vZGU6cGF0aCcpO1xuXG5cdFx0Y29uc3QgdGVtcGxhdGVzU291cmNlID0gam9pbignc3JjJywgJ3RlbXBsYXRlcycpO1xuXHRcdGNvbnN0IHRlbXBsYXRlc0Rlc3QgPSBqb2luKCdkaXN0JywgJ3RlbXBsYXRlcycpO1xuXHRcdGNvbnN0IG5scE1vZGVsU291cmNlID0gam9pbignc3JjJywgJ3NlcnZpY2VzJywgJ21lc3NhZ2UtYW5hbHlzaXMnLCAndHJhaW5pbmcnLCAnbW9kZWwnKTtcblx0XHRjb25zdCBubHBNb2RlbERlc3QgPSBqb2luKCdkaXN0JywgJ21vZGVsJyk7XG5cdFx0Y29uc3QgcHJvbXB0c1NvdXJjZSA9IGpvaW4oJ3NyYycsICdjb25maWcnLCAncHJvbXB0cycpO1xuXHRcdGNvbnN0IHByb21wdHNEZXN0ID0gam9pbignZGlzdCcsICdjb25maWcnLCAncHJvbXB0cycpO1xuXG5cdFx0aWYgKGV4aXN0c1N5bmModGVtcGxhdGVzU291cmNlKSkge1xuXHRcdFx0Y3BTeW5jKHRlbXBsYXRlc1NvdXJjZSwgdGVtcGxhdGVzRGVzdCwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG5cdFx0XHRjb25zb2xlLmxvZygnXHUyNzEzIFRlbXBsYXRlcyBjb3BpYWRvcyBwYXJhIGRpc3QvdGVtcGxhdGVzJyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnNvbGUud2FybignXHUyNkEwIFBhc3RhIHRlbXBsYXRlcyBuXHUwMEUzbyBlbmNvbnRyYWRhIGVtJywgdGVtcGxhdGVzU291cmNlKTtcblx0XHR9XG5cblx0XHRpZiAoZXhpc3RzU3luYyhubHBNb2RlbFNvdXJjZSkpIHtcblx0XHRcdGNwU3luYyhubHBNb2RlbFNvdXJjZSwgbmxwTW9kZWxEZXN0LCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcblx0XHRcdGNvbnNvbGUubG9nKCdcdTI3MTMgTW9kZWxvIE5MUCBjb3BpYWRvIHBhcmEgZGlzdC9tb2RlbCcpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zb2xlLndhcm4oJ1x1MjZBMCBQYXN0YSBkbyBtb2RlbG8gTkxQIG5cdTAwRTNvIGVuY29udHJhZGEgZW0nLCBubHBNb2RlbFNvdXJjZSk7XG5cdFx0fVxuXG5cdFx0aWYgKGV4aXN0c1N5bmMocHJvbXB0c1NvdXJjZSkpIHtcblx0XHRcdGNwU3luYyhwcm9tcHRzU291cmNlLCBwcm9tcHRzRGVzdCwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG5cdFx0XHRjb25zdCBwcm9tcHRzUGF0aCA9IGBkaXN0LyR7Wydjb25maWcnLCAncHJvbXB0cyddLmpvaW4oJy8nKX1gO1xuXHRcdFx0Y29uc29sZS5sb2coYFx1MjcxMyBQcm9tcHRzIFlBTUwgY29waWFkb3MgcGFyYSAke3Byb21wdHNQYXRofWApO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zb2xlLndhcm4oJ1x1MjZBMCBQYXN0YSBkZSBwcm9tcHRzIFlBTUwgblx1MDBFM28gZW5jb250cmFkYSBlbScsIHByb21wdHNTb3VyY2UpO1xuXHRcdH1cblx0fSxcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFtUSxTQUFTLDJCQUEyQjtBQUN2UyxTQUFTLG9CQUFvQjtBQUU3QixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMzQixPQUFPLENBQUMsY0FBYztBQUFBLEVBQ3RCLFFBQVEsQ0FBQyxLQUFLO0FBQUEsRUFDZCxRQUFRO0FBQUEsRUFDUixRQUFRO0FBQUEsRUFDUixPQUFPO0FBQUEsRUFDUCxXQUFXO0FBQUEsRUFDWCxRQUFRO0FBQUEsRUFDUixXQUFXO0FBQUEsRUFDWCxRQUFRO0FBQUE7QUFBQSxFQUVSLFVBQVUsQ0FBQyxjQUFjO0FBQUEsRUFDekIsVUFBVTtBQUFBLEVBQ1YsVUFBVTtBQUFBLEVBQ1YsZ0JBQWdCO0FBQUE7QUFBQTtBQUFBLElBR2YsR0FBSSxRQUFRLElBQUksb0JBQ2I7QUFBQSxNQUNBLG9CQUFvQjtBQUFBLFFBQ25CLEtBQUssUUFBUSxJQUFJLGNBQWM7QUFBQSxRQUMvQixTQUFTLFFBQVEsSUFBSSxrQkFBa0I7QUFBQSxRQUN2QyxXQUFXLFFBQVEsSUFBSTtBQUFBLFFBQ3ZCLFNBQVM7QUFBQSxVQUNSLE1BQU0sWUFBWSxRQUFRLElBQUksdUJBQXVCLE9BQU87QUFBQSxRQUM3RDtBQUFBLFFBQ0EsWUFBWTtBQUFBLFVBQ1gsUUFBUTtBQUFBLFFBQ1Q7QUFBQSxRQUNBLFdBQVc7QUFBQSxNQUNaLENBQUM7QUFBQSxJQUNGLElBQ0MsQ0FBQztBQUFBLEVBQ0w7QUFBQSxFQUNBLFdBQVcsWUFBWTtBQUN0QixVQUFNLEVBQUUsUUFBUSxXQUFXLElBQUksTUFBTSxPQUFPLFNBQVM7QUFDckQsVUFBTSxFQUFFLEtBQUssSUFBSSxNQUFNLE9BQU8sV0FBVztBQUV6QyxVQUFNLGtCQUFrQixLQUFLLE9BQU8sV0FBVztBQUMvQyxVQUFNLGdCQUFnQixLQUFLLFFBQVEsV0FBVztBQUM5QyxVQUFNLGlCQUFpQixLQUFLLE9BQU8sWUFBWSxvQkFBb0IsWUFBWSxPQUFPO0FBQ3RGLFVBQU0sZUFBZSxLQUFLLFFBQVEsT0FBTztBQUN6QyxVQUFNLGdCQUFnQixLQUFLLE9BQU8sVUFBVSxTQUFTO0FBQ3JELFVBQU0sY0FBYyxLQUFLLFFBQVEsVUFBVSxTQUFTO0FBRXBELFFBQUksV0FBVyxlQUFlLEdBQUc7QUFDaEMsYUFBTyxpQkFBaUIsZUFBZSxFQUFFLFdBQVcsS0FBSyxDQUFDO0FBQzFELGNBQVEsSUFBSSwrQ0FBMEM7QUFBQSxJQUN2RCxPQUFPO0FBQ04sY0FBUSxLQUFLLCtDQUF1QyxlQUFlO0FBQUEsSUFDcEU7QUFFQSxRQUFJLFdBQVcsY0FBYyxHQUFHO0FBQy9CLGFBQU8sZ0JBQWdCLGNBQWMsRUFBRSxXQUFXLEtBQUssQ0FBQztBQUN4RCxjQUFRLElBQUksMkNBQXNDO0FBQUEsSUFDbkQsT0FBTztBQUNOLGNBQVEsS0FBSyxtREFBMkMsY0FBYztBQUFBLElBQ3ZFO0FBRUEsUUFBSSxXQUFXLGFBQWEsR0FBRztBQUM5QixhQUFPLGVBQWUsYUFBYSxFQUFFLFdBQVcsS0FBSyxDQUFDO0FBQ3RELFlBQU0sY0FBYyxRQUFRLENBQUMsVUFBVSxTQUFTLEVBQUUsS0FBSyxHQUFHLENBQUM7QUFDM0QsY0FBUSxJQUFJLHFDQUFnQyxXQUFXLEVBQUU7QUFBQSxJQUMxRCxPQUFPO0FBQ04sY0FBUSxLQUFLLHFEQUE2QyxhQUFhO0FBQUEsSUFDeEU7QUFBQSxFQUNEO0FBQ0QsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
