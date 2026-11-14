import { defineConfig, loadEnv, ConfigEnv, UserConfig } from 'vite';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import mkcert from 'vite-plugin-mkcert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id: string) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '');
        return path.resolve(__dirname, 'src/assets', filename);
      }
    },
  };
}

export default defineConfig(({ mode }: ConfigEnv): UserConfig => {
  const env = loadEnv(mode, process.cwd());

  return {
    plugins: [
      figmaAssetResolver(),
      react(),
      tailwindcss(),
      mkcert(), // mkcert가 내부적으로 https 설정을 주입합니다.
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      // 에러 해결 포인트: mkcert를 쓰면 이 줄을 생략해도 되지만,
      // 명시하려면 true 대신 빈 객체 {}를 넣는 것이 타입 안전성이 높습니다.
      // Windows: C:\Windows\System32\drivers\etc\hosts, macOS: /etc/hosts 에서 도메인을 127.0.0.1로 연결해야 합니다.
      host: 'local.altosfunding.com',
      https: {},
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://121.254.254.52:8200',
          changeOrigin: true,
          secure: false,
        },
      },
    },
    assetsInclude: ['**/*.svg', '**/*.csv'],
  };
});
