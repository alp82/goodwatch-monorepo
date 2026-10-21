import { fileURLToPath } from 'node:url'
export default { envDir: '/tmp/yepwatch-no-implicit-env', resolve: { alias: { '~': fileURLToPath(new URL('../../', import.meta.url)) } } }
