import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Normalize city name - maps many Hebrew/English/abbreviated variations to standard Hebrew name
function normalizeCityName(cityName) {
  if (!cityName) return null;
  const raw = cityName.trim();
  const lower = raw.toLowerCase();

  const cityMap = {
    'תל אביב': ['תל אביב', 'tel aviv', 'tlv', 'ת״א', 'ת"א', 'תל-אביב', 'תל אביב יפו', 'tel-aviv', 'telaviv'],
    'ירושלים': ['ירושלים', 'jerusalem', 'ירושלם', 'yerushalayim'],
    'חיפה': ['חיפה', 'haifa'],
    'באר שבע': ['באר שבע', 'beer sheva', "be'er sheva", 'באר-שבע', 'ב״ש', 'beersheba', 'beersheva', 'beer-sheva'],
    'פתח תקווה': ['פתח תקווה', 'petah tikva', 'petach tikva', 'פ״ת', 'petah-tikva', 'petachtikva'],
    'ראשון לציון': ['ראשון לציון', 'rishon lezion', 'ראשל"צ', 'rishon-lezion', 'rishon le-zion', 'rishonlezion'],
    'אשדוד': ['אשדוד', 'ashdod'],
    'נתניה': ['נתניה', 'netanya', 'natanya', 'netania'],
    'בני ברק': ['בני ברק', 'bnei brak', 'bnei-brak', 'בני-ברק', 'bney brak'],
    'רמת גן': ['רמת גן', 'ramat gan', 'ramat-gan'],
    'הרצלייה': ['הרצלייה', 'herzliya', 'herzlia', 'herzliyya', 'הרצליה'],
    'חולון': ['חולון', 'holon'],
    'רעננה': ['רעננה', 'raanana', "ra'anana", 'ra`anana', 'raanana'],
    'מודיעין': ['מודיעין', 'modiin', "modi'in", 'מודיעין-מכבים-רעות', 'modiin-maccabim', 'modin'],
    'כפר סבא': ['כפר סבא', 'kfar saba', 'kfar-saba', 'kafar saba'],
    'רחובות': ['רחובות', 'rehovot', 'rechovot'],
    'נס ציונה': ['נס ציונה', 'ness ziona', 'nes ziona', 'nessziona'],
    'יבנה': ['יבנה', 'yavne', 'yavneh', 'javne'],
    'אילת': ['אילת', 'eilat', 'elat'],
    'אשקלון': ['אשקלון', 'ashkelon', 'ascalon', 'askelon'],
    'חדרה': ['חדרה', 'hadera', 'hadera', 'hadara'],
    'לוד': ['לוד', 'lod', 'lydda'],
    'רמלה': ['רמלה', 'ramla', 'ramle'],
    'קריית גת': ['קריית גת', 'kiryat gat', 'kiryat-gat', 'qiryat gat'],
    'אופקים': ['אופקים', 'ofakim'],
    'עכו': ['עכו', 'akko', 'acre', 'acco', 'ako'],
    'נהריה': ['נהריה', 'nahariya', 'nahariyya', 'nahariyah'],
    'כרמיאל': ['כרמיאל', 'karmiel', "karmi'el", 'carmiel'],
    'צפת': ['צפת', 'safed', 'zefat', 'tsfat', 'tzfat'],
    'טבריה': ['טבריה', 'tiberias', 'tveria'],
    'נצרת': ['נצרת', 'nazareth', 'natzrat'],
    'אום אל-פחם': ['אום אל-פחם', 'umm al-fahm', 'um al-fahm', 'umm el-fahm'],
    'מעלה אדומים': ["מעלה אדומים", "ma'ale adumim", 'maale adumim', 'maaleh adumim'],
    'בית שמש': ['בית שמש', 'beit shemesh', 'bet shemesh', 'beit-shemesh', 'bet-shemesh'],
    'גבעת שמואל': ['גבעת שמואל', 'givat shmuel', "givat shmu'el"],
    'גבעתיים': ['גבעתיים', 'givatayim'],
    'ראש העין': ['ראש העין', "rosh ha'ayin", 'rosh haayin', 'rosh ha-ayin'],
    'יהוד': ['יהוד', 'yehud', 'yehud-monosson'],
    'בת ים': ['בת ים', 'bat yam', 'bat-yam', 'batyam'],
    'קריית אונו': ['קריית אונו', 'kiryat ono', 'qiryat ono'],
    'אור יהודה': ['אור יהודה', 'or yehuda', 'or-yehuda'],
    'אלעד': ['אלעד', "el'ad", 'elad'],
    'הוד השרון': ['הוד השרון', 'hod hasharon', 'hod-hasharon'],
    'כפר יונה': ['כפר יונה', 'kfar yona', 'kfar-yona'],
    'זכרון יעקב': ['זכרון יעקב', 'zichron yaakov', "zikhron ya'akov", 'zikron yaakov'],
    'עפולה': ['עפולה', 'afula', 'affuleh', 'afulah'],
    'טירת כרמל': ['טירת כרמל', 'tirat carmel', 'tirat-carmel', 'tirat karmel'],
    'דימונה': ['דימונה', 'dimona'],
    'ערד': ['ערד', 'arad'],
    'ירוחם': ['ירוחם', 'yerucham'],
    'מצפה רמון': ['מצפה רמון', 'mitzpe ramon', 'mitspeh ramon', 'mizpe ramon'],
    'שדרות': ['שדרות', 'sderot'],
    'נתיבות': ['נתיבות', 'netivot'],
    'קריית שמונה': ['קריית שמונה', 'kiryat shmona', 'kiryat-shmona', 'qiryat shemona'],
    'מגדל העמק': ['מגדל העמק', 'migdal haemek', 'migdal-haemek'],
    'יוקנעם': ['יוקנעם', "yokne'am", 'yokneam'],
    'אבן יהודה': ['אבן יהודה', 'even yehuda', 'even-yehuda'],
    'קדומים': ['קדומים', 'kedumim'],
    'גן יבנה': ['גן יבנה', 'gan yavne'],
    'רהט': ['רהט', 'rahat'],
    'טירה': ['טירה', 'tire', 'tira'],
    'באקה אל-גרבייה': ['באקה אל-גרבייה', 'baqa al-gharbiyye', 'baka el-garbia'],
    'ערערה': ['ערערה', "ar'ara"],
    'שפרעם': ['שפרעם', "shfar'am", 'shfaram'],
    'קריית אתא': ['קריית אתא', 'kiryat ata', 'kiryat-ata'],
    'קריית מוצקין': ['קריית מוצקין', 'kiryat motzkin'],
    'קריית ביאליק': ['קריית ביאליק', 'kiryat bialik'],
    'קריית ים': ['קריית ים', 'kiryat yam'],
    'קריית מלאכי': ['קריית מלאכי', 'kiryat malachi'],
    'גדרה': ['גדרה', 'gedera', 'gadera'],
    'כפר יוסף': ['כפר יוסף', 'kfar yosef'],
    'מזכרת בתיה': ['מזכרת בתיה', 'mazkeret batya'],
    'שוהם': ['שוהם', 'shoham'],
    'מכבים רעות': ['מכבים רעות', 'maccabim reut', 'maccabim-reut'],
    'כפר שמריהו': ['כפר שמריהו', 'kfar shmariyahu'],
    'סביון': ['סביון', 'savyon'],
    'אפרתה': ['אפרתה', 'efrat', 'efrata'],
    'מבשרת ציון': ['מבשרת ציון', 'mevaseret zion', 'mevasseret zion'],
    'גבעון החדשה': ['גבעון החדשה', 'givon hachadasha'],
    'אריאל': ['אריאל', 'ariel'],
    'רעות': ['רעות', 'reut'],
    'כפר סאלד': ['כפר סאלד', 'kfar sold'],
    'מעלות תרשיחא': ['מעלות תרשיחא', 'maалот', "ma'alot-tarshiha"],
    'חצור הגלילית': ['חצור הגלילית', 'hazor haglilit'],
    'קרית שמונה': ['קרית שמונה', 'kiryat shmona'],
    'גבעת זאב': ['גבעת זאב', 'givat zeev'],
    'ביתר עילית': ['ביתר עילית', 'beitar illit'],
    'מודיעין עילית': ['מודיעין עילית', 'modiin illit', 'kiryat sefer'],
    'אלפי מנשה': ['אלפי מנשה', 'alfe menashe'],
  };

  for (const [standard, variations] of Object.entries(cityMap)) {
    if (variations.some(v => lower.includes(v.toLowerCase()))) {
      return standard;
    }
  }

  return raw;
}

// Fuzzy match: tries to find the best matching GeoCity record from the full list
function findBestCityMatch(targetName, geoCities) {
  if (!targetName || geoCities.length === 0) return null;

  // Normalize: strip spaces, hyphens, quotes for comparison
  const stripChars = (s) => (s || '').trim().toLowerCase().replace(/[-\s'"״׳"'`]+/g, '');
  const target = stripChars(targetName);
  if (!target) return null;

  // Try exact stripped match first
  for (const city of geoCities) {
    const hebrewStripped = stripChars(city.city_name_hebrew);
    if (hebrewStripped && hebrewStripped === target) return city;
  }

  // Try contains match (target contains city name or vice versa)
  for (const city of geoCities) {
    const hebrewStripped = stripChars(city.city_name_hebrew);
    if (hebrewStripped && hebrewStripped.length >= 3) {
      if (target.includes(hebrewStripped) || hebrewStripped.includes(target)) {
        return city;
      }
    }
  }

  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { entity_type, entity_id, location_text } = await req.json();

    if (!entity_type || !entity_id) {
      return Response.json({ error: 'Missing entity_type or entity_id' }, { status: 400 });
    }

    if (entity_type !== 'Candidate' && entity_type !== 'Job') {
      return Response.json({ error: 'entity_type must be Candidate or Job' }, { status: 400 });
    }

    // Get the entity
    const entities = await base44.asServiceRole.entities[entity_type].filter({ id: entity_id });
    if (entities.length === 0) {
      return Response.json({ error: `${entity_type} not found` }, { status: 404 });
    }

    const entity = entities[0];
    const textToNormalize = location_text || entity.city || entity.location;

    if (!textToNormalize) {
      return Response.json({
        success: false,
        reason: 'NO_LOCATION_DATA',
        message: 'אין נתוני מיקום זמינים'
      });
    }

    // Step 1: Map variation → standard Hebrew name
    const normalizedCity = normalizeCityName(textToNormalize);

    let updateData = {};
    let matchSource = null;

    // Step 2: Exact match in GeoCity database
    try {
      const geoCitiesExact = await base44.asServiceRole.entities.GeoCity.filter({
        city_name_hebrew: normalizedCity
      });

      if (geoCitiesExact.length > 0) {
        const geoCity = geoCitiesExact[0];
        updateData = {
          geo_city_id: geoCity.id,
          geo_latitude: geoCity.latitude,
          geo_longitude: geoCity.longitude,
          geo_location_source: 'city_lookup_exact',
          geo_last_normalized: new Date().toISOString()
        };
        matchSource = 'city_lookup_exact';
      }
    } catch (dbErr) {
      console.log('GeoCity exact lookup error:', dbErr.message);
    }

    // Step 3: Fuzzy match against full GeoCity list (if exact match failed)
    if (!matchSource) {
      try {
        const allGeoCities = await base44.asServiceRole.entities.GeoCity.list('-city_name_hebrew', 2000);

        if (allGeoCities.length > 0) {
          // Try with normalizedCity first, then original text
          const fuzzyMatch =
            findBestCityMatch(normalizedCity, allGeoCities) ||
            findBestCityMatch(textToNormalize, allGeoCities);

          if (fuzzyMatch) {
            updateData = {
              geo_city_id: fuzzyMatch.id,
              geo_latitude: fuzzyMatch.latitude,
              geo_longitude: fuzzyMatch.longitude,
              geo_location_source: 'city_lookup_fuzzy',
              geo_last_normalized: new Date().toISOString()
            };
            matchSource = 'city_lookup_fuzzy';
            console.log(`Fuzzy match: "${textToNormalize}" → "${fuzzyMatch.city_name_hebrew}"`);
          }
        }
      } catch (fuzzyErr) {
        console.log('Fuzzy city lookup error:', fuzzyErr.message);
      }
    }

    // Step 4: Nominatim geocoding fallback
    if (!matchSource) {
      try {
        // Try Hebrew/original text first, then a simpler transliteration
        const queries = [
          `${textToNormalize}, Israel`,
          `${normalizedCity}, ישראל`
        ];

        for (const q of queries) {
          const geocodeUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=il`;

          const geocodeResponse = await fetch(geocodeUrl, {
            headers: { 'User-Agent': 'HRAI-Recruitment-App/1.0 (contact@hrai.co.il)' },
            signal: AbortSignal.timeout(8000)
          });

          if (!geocodeResponse.ok) {
            console.log(`Nominatim HTTP ${geocodeResponse.status} for: ${q}`);
            continue;
          }

          const geocodeData = await geocodeResponse.json();
          if (geocodeData.length > 0) {
            const result = geocodeData[0];
            updateData = {
              geo_latitude: parseFloat(result.lat),
              geo_longitude: parseFloat(result.lon),
              geo_location_source: 'nominatim',
              geo_last_normalized: new Date().toISOString()
            };
            matchSource = 'nominatim';
            console.log(`Nominatim found: "${textToNormalize}" → lat=${result.lat}, lon=${result.lon} (${result.display_name})`);
            break;
          }
        }
      } catch (nominatimErr) {
        console.log(`Nominatim geocoding failed for "${textToNormalize}":`, nominatimErr.message);
      }
    }

    if (!matchSource) {
      return Response.json({
        success: false,
        reason: 'LOCATION_NOT_FOUND',
        message: `המיקום "${textToNormalize}" לא נמצא במאגר הגיאוגרפי`
      });
    }

    // Set the normalized city name on the entity
    if (entity_type === 'Candidate') {
      updateData.city = normalizedCity || textToNormalize;
    } else {
      updateData.location = normalizedCity || textToNormalize;
    }

    // Update entity with geo coordinates
    await base44.asServiceRole.entities[entity_type].update(entity_id, updateData);

    // Invalidate GeoFitResult cache for this entity (non-critical - wrapped in try/catch)
    try {
      const filterKey = entity_type === 'Candidate' ? { candidate_id: entity_id } : { job_id: entity_id };
      const oldResults = await base44.asServiceRole.entities.GeoFitResult.filter(filterKey);
      for (const result of oldResults) {
        try {
          await base44.asServiceRole.entities.GeoFitResult.delete(result.id);
        } catch (_) { /* ignore single delete failures */ }
      }
    } catch (cacheErr) {
      console.log('Cache invalidation warning (non-critical):', cacheErr.message);
    }

    return Response.json({
      success: true,
      normalized_location: normalizedCity || textToNormalize,
      latitude: updateData.geo_latitude,
      longitude: updateData.geo_longitude,
      source: matchSource,
      cache_invalidated: true
    });

  } catch (error) {
    console.error('Location normalization error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
