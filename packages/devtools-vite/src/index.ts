import { defineDevframe } from 'devframe'
import { devframeViteBridge } from '@devframes/vite/single'
import type { Plugin } from 'vite'

const devframe = defineDevframe({
  id: 'pmndrs-devtools',
  name: 'PMNDRS DevTools',
  version: '0.0.1-alpha',
  packageName: '@pmndrs/devtools',
  description: 'PMNDRS DevTools bridge.',
  homepage: 'https://github.com/pmndrs',
  importMetaUrl: import.meta.url,
  basePath: '/__pmndrs-devtools/',
  setup() {},
})

export interface PmndrsDevtoolsViteOptions {
  host?: string
  port?: number
  auth?: boolean
  base?: string
}

function queryModePlugin(): Plugin {
  return {
    name: 'pmndrs-devtools-query-modes',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const rawUrl = ctx.originalUrl ?? ctx.path
        const url = new URL(rawUrl, 'http://pmndrs-devtools.local')
        const isDevtools = url.searchParams.has('devtools')
        const isDebug = url.searchParams.has('debug')

        if (!isDevtools && !isDebug) return

        if (isDevtools) {
          const stripped = html.replace(
            /<body[\s\S]*<\/body>/i,
            '<body></body>',
          )
          return {
            html: stripped,
            tags: [
              {
                tag: 'script',
                attrs: { type: 'module' },
                children:
                  "import { mountDevtools } from '@pmndrs/devtools-ui'; await mountDevtools(document.body)",
                injectTo: 'body',
              },
            ],
          }
        }

        return {
          html,
          tags: [
            {
              tag: 'script',
              attrs: { type: 'module' },
              children:
                "import { mountInlineControls } from '@pmndrs/devtools-ui'; await mountInlineControls(document.body)",
              injectTo: 'body',
            },
          ],
        }
      },
    },
  }
}

export function pmndrsDevtools(
  options: PmndrsDevtoolsViteOptions = {},
): Plugin {
  const bridge = devframeViteBridge(devframe, {
    auth: options.auth ?? false,
    host: options.host ?? 'localhost',
    ...(options.port === undefined ? {} : { port: options.port }),
    allowedOrigins: false,
    base: options.base ?? '/__pmndrs-devtools/',
  }) as Plugin

  const plugins = [bridge, queryModePlugin()]
  return plugins as unknown as Plugin
}

export { devframe }
