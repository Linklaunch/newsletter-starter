import {createLogger} from '@lib/logger'
import {assertImageGenerationEnabled} from '../lib/server-config'

const log = createLogger('Newsletter:ImageGen')

export interface ImageGenerationConfig {
  apiKey: string
  baseUrl: string
  model: string
}

export interface GeneratedImage {
  imageBytes: Uint8Array
  contentType: string
}

export interface GenerateBrandedSectionImageInput {
  headline: string
  bodyMarkdown: string
  soWhat: string
  sourceUrl: string
  referenceImageUrl: string | null
  brand: {newsletter: string; parent: string; site: string}
  config: ImageGenerationConfig
  systemPrompt?: string
  imagePrompt?: string
}

interface GeminiInlineData {
  mimeType?: string
  mime_type?: string
  data?: string
}

interface GeminiPart {
  text?: string
  inlineData?: GeminiInlineData
  inline_data?: GeminiInlineData
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[]
    }
  }>
}

interface GeminiRequestPart {
  text?: string
  inlineData?: {
    mimeType: string
    data: string
  }
}

export function loadImageGenerationConfigFromEnv(): ImageGenerationConfig {
  const config = assertImageGenerationEnabled()
  return {apiKey: config.apiKey, baseUrl: config.baseUrl, model: config.model}
}

export async function generateBrandedSectionImage(
  input: GenerateBrandedSectionImageInput
): Promise<GeneratedImage> {
  assertImageGenerationEnabled()
  const systemPrompt =
    input.systemPrompt?.trim() || buildDefaultImageSystemPrompt(input.brand)
  const imagePrompt =
    input.imagePrompt?.trim() || buildDefaultImagePrompt(input)
  const parts: GeminiRequestPart[] = [{text: imagePrompt}]
  const reference = input.referenceImageUrl
    ? await fetchReferenceImage(input.referenceImageUrl).catch(err => {
        log.warn('reference image fetch failed')
        return null
      })
    : null
  if (reference) {
    parts.push({
      inlineData: {
        mimeType: reference.contentType,
        data: Buffer.from(reference.imageBytes).toString('base64')
      }
    })
  }

  log.info('generating branded image')
  const endpoint = `${input.config.baseUrl.replace(/\/$/, '')}/models/${input.config.model}:generateContent`
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-goog-api-key': input.config.apiKey
    },
    body: JSON.stringify({
      systemInstruction: {parts: [{text: systemPrompt}]},
      contents: [{parts}],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE']
      }
    })
  })
  const bodyText = await res.text()
  if (!res.ok) {
    throw new Error(`image generation provider failed (status ${res.status})`)
  }
  let json: GeminiResponse
  try {
    json = JSON.parse(bodyText) as GeminiResponse
  } catch {
    throw new Error('image generation provider returned invalid JSON')
  }
  const image = firstInlineImage(json)
  if (!image?.data) {
    throw new Error(
      'Nano Banana Pro response did not include generated image data'
    )
  }
  return {
    imageBytes: Uint8Array.from(Buffer.from(image.data, 'base64')),
    contentType: image.mimeType ?? image.mime_type ?? 'image/png'
  }
}

function firstInlineImage(json: GeminiResponse): GeminiInlineData | null {
  for (const candidate of json.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      const inline = part.inlineData ?? part.inline_data
      if (inline?.data) return inline
    }
  }
  return null
}

async function fetchReferenceImage(url: string): Promise<GeneratedImage> {
  const res = await fetch(url)
  if (!res.ok)
    throw new Error(`reference image download failed (${res.status})`)
  const contentType = res.headers.get('content-type') ?? 'image/jpeg'
  const buf = await res.arrayBuffer()
  return {imageBytes: new Uint8Array(buf), contentType}
}

export function buildDefaultImageSystemPrompt(brand: {
  newsletter: string
  parent: string
  site: string
}): string {
  return [
    `You are the art director for ${brand.newsletter}, published by ${brand.parent}.`,
    'Create a clear, original editorial illustration that supports the section idea.',
    'Style: warm studio background, simple dimensional objects, soft shadows, approachable composition, and strong contrast at email size.',
    'Palette: warm coral accent, soft cream background, muted blue and green accents, and charcoal details only when necessary.',
    'Subject matter: derive the visual metaphor from the section text. Prefer simple symbolic objects over literal scenes, for example notebooks, calendars, simple charts, sticky notes, and light bulbs.',
    'Avoid readable text, logos, screenshots, UI, photorealistic faces, clutter, watermarks, harsh gradients, and photo collages.',
    'Composition: square 1024x1024, one central object group, generous whitespace.'
  ].join('\n')
}

export function buildDefaultImagePrompt(
  input: Omit<GenerateBrandedSectionImageInput, 'config'>
): string {
  const reference = input.referenceImageUrl
    ? `Use the attached source image as loose visual/context reference, not as a photo collage. Source URL: ${input.referenceImageUrl}`
    : `No source image is available; infer the visual metaphor from the section text and source URL: ${input.sourceUrl}`
  return [
    'Create one branded 3D editorial image for this newsletter section.',
    reference,
    '',
    `Section headline: ${input.headline}`,
    `Section body: ${input.bodyMarkdown.slice(0, 900)}`,
    `Reader takeaway: ${input.soWhat}`
  ].join('\n')
}
