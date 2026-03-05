export async function schedulePurerandomDraw(draw: {
  promotionName: string
  tsCode: string
  drawName: string
  drawDate: string
  drawTime?: string
  numWinners: number
}): Promise<{ drawId: string; uploadUrl: string | null; drawDate: string } | null> {
  try {
    const res = await fetch(`${process.env.PURERANDOM_URL}/api/turnstyle/schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': process.env.PURERANDOM_ADMIN_KEY || '',
      },
      body: JSON.stringify({
        promotion_name: draw.promotionName,
        ts_code: draw.tsCode,
        draw_name: draw.drawName,
        draw_date: draw.drawDate,
        draw_time: draw.drawTime || '10:00',
        num_winners: draw.numWinners,
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return {
      drawId: data.draw_id,
      uploadUrl: data.upload_url,
      drawDate: data.draw_date,
    }
  } catch (e) {
    console.error('PureRandom schedule error:', e)
    return null
  }
}
