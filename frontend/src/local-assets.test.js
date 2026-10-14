import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const productionRoot = resolve(frontendRoot, '..', 'static', 'app')

function nonLoopback(url) {
  const host = new URL(url, 'http://localhost').hostname
  return !['localhost', '127.0.0.1', '::1'].includes(host)
}

function remoteHtmlAssets(source) {
  return [...source.matchAll(/(?:src|href)\s*=\s*["']((?:https?:)?\/\/[^"']+)["']/gi)]
    .map((match) => match[1])
    .filter(nonLoopback)
}

function remoteCssAssets(source) {
  return [...source.matchAll(/url\(\s*["']?((?:https?:)?\/\/[^)'"\s]+)["']?\s*\)/gi)]
    .map((match) => match[1])
    .filter(nonLoopback)
}

test('source and shipped runtime assets stay local-only', () => {
  const htmlFiles = [join(frontendRoot, 'index.html'), join(productionRoot, 'index.html')]
  const cssFiles = readdirSync(join(productionRoot, 'assets'))
    .filter((name) => name.endsWith('.css'))
    .map((name) => join(productionRoot, 'assets', name))

  const remoteReferences = [
    ...htmlFiles.flatMap((path) => remoteHtmlAssets(readFileSync(path, 'utf8')).map((url) => `${path}: ${url}`)),
    ...cssFiles.flatMap((path) => remoteCssAssets(readFileSync(path, 'utf8')).map((url) => `${path}: ${url}`)),
  ]

  expect(remoteReferences).toEqual([])
})
