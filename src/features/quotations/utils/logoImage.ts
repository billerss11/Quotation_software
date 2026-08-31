export interface ResizedLogoDataUrl {
  dataUrl: string
  originalWidth: number
  originalHeight: number
  width: number
  height: number
}

export async function resizeLogoDataUrl(dataUrl: string, maximumDimension: number): Promise<ResizedLogoDataUrl> {
  const image = await loadImage(dataUrl)
  const originalWidth = image.naturalWidth
  const originalHeight = image.naturalHeight
  const scale = Math.min(1, maximumDimension / originalWidth, maximumDimension / originalHeight)
  const width = Math.max(1, Math.round(originalWidth * scale))
  const height = Math.max(1, Math.round(originalHeight * scale))
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Could not prepare the logo for resizing.')
  }

  canvas.width = width
  canvas.height = height
  context.drawImage(image, 0, 0, width, height)

  return {
    dataUrl: canvas.toDataURL(getOutputMimeType(dataUrl), 0.92),
    originalWidth,
    originalHeight,
    width,
    height,
  }
}

function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image), { once: true })
    image.addEventListener('error', () => reject(new Error('Could not decode the selected logo.')), { once: true })
    image.src = dataUrl
  })
}

function getOutputMimeType(dataUrl: string) {
  const mimeType = /^data:(image\/(?:png|jpeg|webp));/i.exec(dataUrl)?.[1]?.toLowerCase()
  return mimeType ?? 'image/png'
}
