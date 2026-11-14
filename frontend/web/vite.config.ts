import { defineConfig, loadEnv } from 'vite';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import mkcert from 'vite-plugin-mkcert';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Figma에서 내보낸 'figma:asset/...' import를 src/assets 아래 파일로 연결한다.
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

export default defineConfig(({ mode, command }) => {
  // 개발 서버 설정은 .env.local 등에서 바꿀 수 있다. (.env.example 참고)
  const env = loadEnv(mode, __dirname, '');
  const devHost = env.DEV_SERVER_HOST || 'local.altosfunding.com';
  const devPort = Number(env.DEV_SERVER_PORT || 5173);
  const apiProxyTarget = env.API_PROXY_TARGET || 'http://121.254.254.52:8200';
  // mkcert는 로컬 개발 서버용 HTTPS 인증서를 만든다. DEV_SERVER_HTTPS=false 로 끌 수 있고, 빌드 때는 쓰지 않는다.
  const useHttps = command === 'serve' && env.DEV_SERVER_HTTPS !== 'false';

  return {
    plugins: [figmaAssetResolver(), react(), tailwindcss(), ...(useHttps ? [mkcert()] : [])],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      // 커스텀 도메인을 쓰려면 hosts 파일에서 도메인을 127.0.0.1로 연결해야 한다.
      // Windows: C:\Windows\System32\drivers\etc\hosts, macOS: /etc/hosts
      host: devHost,
      ...(useHttps ? { https: {} } : {}),
      port: devPort,
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    assetsInclude: ['**/*.svg', '**/*.csv'],
  };
});
