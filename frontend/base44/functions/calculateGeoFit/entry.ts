import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Haversine formula for air distance (pure math, cannot fail)
function calculateAirDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Calculate road distance using OSRM with timeout
async function calculateRoadDistance(lat1, lon1, lat2, lon2) {
  const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(10000) // 10 second timeout — prevents hanging indefinitely
  });

  if (!response.ok) {
    throw new Error(`OSRM HTTP ${response.status}`);
  }

  const data = await response.json();
  if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
    throw new Error('OSRM no route found');
  }

  return data.routes[0].distance / 1000; // meters → km
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { candidate_id, job_id } = await req.json();

    if (!candidate_id || !job_id) {
      return Response.json({ error: 'Missing candidate_id or job_id' }, { status: 400 });
    }

    // Check for a valid cached result
    const existingResults = await base44.asServiceRole.entities.GeoFitResult.filter({
      candidate_id,
      job_id
    });

    const now = new Date();
    const validCached = existingResults.find(r => r.expires_at && new Date(r.expires_at) > now);

    if (validCached) {
      return Response.json({ success: true, cached: true, result: validCached });
    }

    // Delete all stale/expired results for this pair to prevent accumulation
    for (const old of existingResults) {
      try {
        await base44.asServiceRole.entities.GeoFitResult.delete(old.id);
      } catch (_) { /* ignore individual delete failures */ }
    }

    // Fetch candidate and job entities
    let candidateData = null;
    let jobData = null;

    try {
      const r = await base44.asServiceRole.entities.Candidate.filter({ id: candidate_id });
      candidateData = Array.isArray(r) ? r[0] : r;
    } catch (err) {
      console.error('Error fetching candidate:', err.message);
    }

    try {
      const r = await base44.asServiceRole.entities.Job.filter({ id: job_id });
      jobData = Array.isArray(r) ? r[0] : r;
    } catch (err) {
      console.error('Error fetching job:', err.message);
    }

    if (!candidateData || !jobData) {
      return Response.json({
        error: 'Candidate or Job not found',
        details: `candidate_found: ${!!candidateData}, job_found: ${!!jobData}`
      }, { status: 404 });
    }

    const thresholdKm = jobData.geo_threshold_km || 70;

    // Parse and validate coordinates (guard against null, empty string, or "null" strings)
    const candidateLat = parseFloat(candidateData.geo_latitude);
    const candidateLon = parseFloat(candidateData.geo_longitude);
    const jobLat = parseFloat(jobData.geo_latitude);
    const jobLon = parseFloat(jobData.geo_longitude);

    const hasCandidateLoc = candidateData.geo_latitude && candidateData.geo_longitude &&
                            !isNaN(candidateLat) && !isNaN(candidateLon);
    const hasJobLoc = jobData.geo_latitude && jobData.geo_longitude &&
                      !isNaN(jobLat) && !isNaN(jobLon);

    let geoFitResult;

    if (!hasCandidateLoc || !hasJobLoc) {
      // Missing/invalid location data — allow the match but flag it
      geoFitResult = {
        candidate_id,
        job_id,
        geo_status: 'UNKNOWN_ALLOWED',
        distance_km: null,
        threshold_km: thresholdKm,
        method: null,
        reason_code: 'MISSING_LOCATION_DATA',
        candidate_location_normalized: candidateData.city || 'לא ידוע',
        job_location_normalized: jobData.location || 'לא ידוע',
        computed_at: now.toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };
    } else {
      let distanceKm;
      let method;

      try {
        // Try road distance via OSRM (with 10s timeout)
        distanceKm = await calculateRoadDistance(candidateLat, candidateLon, jobLat, jobLon);
        method = 'ROAD';
      } catch (roadError) {
        // OSRM failed (timeout, server down, rate limit) — fall back to air distance
        console.log(`OSRM failed (${roadError.message}), using Haversine air distance fallback`);
        distanceKm = calculateAirDistance(candidateLat, candidateLon, jobLat, jobLon);
        method = 'AIR_FALLBACK';
      }

      // Guard against unexpected NaN/Infinity from bad coordinates
      if (!isFinite(distanceKm) || isNaN(distanceKm)) {
        console.error(`Invalid distance calculated: ${distanceKm} for candidate=${candidate_id}, job=${job_id}`);
        geoFitResult = {
          candidate_id,
          job_id,
          geo_status: 'NEEDS_REVIEW',
          distance_km: null,
          threshold_km: thresholdKm,
          method: null,
          reason_code: 'CALCULATION_FAILED',
          candidate_location_normalized: candidateData.city || 'לא ידוע',
          job_location_normalized: jobData.location || 'לא ידוע',
          computed_at: now.toISOString(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // retry in 1 day
        };
      } else {
        const geoStatus = distanceKm <= thresholdKm ? 'APPROVED' : 'REJECTED';

        geoFitResult = {
          candidate_id,
          job_id,
          geo_status: geoStatus,
          distance_km: Math.round(distanceKm * 10) / 10,
          threshold_km: thresholdKm,
          method,
          reason_code: geoStatus === 'APPROVED' ? 'WITHIN_THRESHOLD' : 'EXCEEDS_THRESHOLD',
          candidate_location_normalized: candidateData.city || `${candidateLat},${candidateLon}`,
          job_location_normalized: jobData.location || `${jobLat},${jobLon}`,
          computed_at: now.toISOString(),
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        };
      }
    }

    // Save result to cache
    await base44.asServiceRole.entities.GeoFitResult.create(geoFitResult);

    return Response.json({ success: true, cached: false, result: geoFitResult });

  } catch (error) {
    console.error('GeoFit calculation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
