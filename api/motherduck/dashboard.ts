/**
 * Vercel API Route: POST /api/motherduck/dashboard
 *
 * Get all dashboard data in a single call.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  getTimelineData,
  getAttackDistribution,
  getTopTalkers,
  getFlows,
  getFlowCount,
  convertBigInts,
} from './_shared'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const {
      bucketMinutes = 60,
      whereClause = '1=1',
      limit = 1000,
      offset = 0,
    } = req.body || {}

    // Execute all queries in parallel
    const [timeline, attacks, topSrcIPs, topDstIPs, flows, totalCount] =
      await Promise.all([
        getTimelineData(bucketMinutes, whereClause),
        getAttackDistribution(),
        getTopTalkers('src', 'flows', 10, whereClause),
        getTopTalkers('dst', 'flows', 10, whereClause),
        getFlows(whereClause, limit, offset),
        getFlowCount(whereClause),
      ])

    const data = {
      timeline: convertBigInts(timeline),
      attacks: convertBigInts(attacks),
      topSrcIPs: convertBigInts(topSrcIPs),
      topDstIPs: convertBigInts(topDstIPs),
      flows: convertBigInts(flows),
      totalCount: Number(totalCount),
    }

    return res.status(200).json({ success: true, data })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('MotherDuck dashboard error:', errorMessage)
    return res.status(500).json({
      success: false,
      error: errorMessage,
    })
  }
}
