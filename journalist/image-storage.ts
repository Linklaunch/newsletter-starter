import {put} from '@vercel/blob'
import {createLogger} from '@lib/logger'
import {assertImageGenerationEnabled} from '../lib/server-config'

const log = createLogger('Newsletter:ImageStorage')

export interface StoreNewsletterImageInput {
  slug: string
  sectionIndex: number
  imageBytes: Uint8Array
  contentType: string
}

export async function storeNewsletterImage(
  input: StoreNewsletterImageInput
): Promise<string> {
  assertImageGenerationEnabled()
  const extension = extensionForContentType(input.contentType)
  const pathname = `newsletter/sections/${input.slug}/section-${input.sectionIndex + 1}${extension}`
  const blob = await put(pathname, Buffer.from(input.imageBytes), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: input.contentType
  })
  log.info('stored generated image')
  return blob.url
}

function extensionForContentType(contentType: string): string {
  const lower = contentType.toLowerCase()
  if (lower.includes('jpeg') || lower.includes('jpg')) return '.jpg'
  if (lower.includes('webp')) return '.webp'
  return '.png'
}
