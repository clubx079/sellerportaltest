import { NextResponse } from 'next/server'
import convert from 'heic-convert'

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

    const inputBuffer = Buffer.from(await file.arrayBuffer())
    const outputBuffer = await convert({ buffer: inputBuffer, format: 'JPEG', quality: 0.7 })

    return new Response(outputBuffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Disposition': 'inline',
      },
    })
  } catch (err) {
    console.error('[convert-heic]', err)
    return NextResponse.json({ error: 'Conversion failed' }, { status: 500 })
  }
}
