import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Strict runtime validation for incoming request body
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

interface IncomingRequestBody {
  dateOfBirth: string;
  timeOfBirth: string;
  placeOfBirth: string;
  name?: string | null;
  gender?: string | null;
  timezone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

interface EngineRequestPayload {
  date: string;
  time: string;
  timezone: string;
  latitude: number;
  longitude: number;
  name?: string | null;
  gender?: string | null;
}

function validateEngineRequestBody(body: any): IncomingRequestBody {
  const { dateOfBirth, timeOfBirth, placeOfBirth, name, gender, timezone, latitude, longitude } = body ?? {};

  const errors: string[] = [];

  if (!isNonEmptyString(dateOfBirth)) {
    errors.push('dateOfBirth is required and must be a non-empty string');
  }
  if (!isNonEmptyString(timeOfBirth)) {
    errors.push('timeOfBirth is required and must be a non-empty string');
  }
  if (!isNonEmptyString(placeOfBirth)) {
    errors.push('placeOfBirth is required and must be a non-empty string');
  }

  if (timezone != null && timezone !== undefined && !isNonEmptyString(timezone)) {
    errors.push('timezone, if provided, must be a non-empty string');
  }

  if (latitude != null && latitude !== undefined) {
    if (typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      errors.push('latitude, if provided, must be a finite number between -90 and 90');
    }
  }

  if (longitude != null && longitude !== undefined) {
    if (typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      errors.push('longitude, if provided, must be a finite number between -180 and 180');
    }
  }

  if (errors.length > 0) {
    const message = errors.join('; ');
    throw new Error(message);
  }

  return {
    dateOfBirth: dateOfBirth.trim(),
    timeOfBirth: timeOfBirth.trim(),
    placeOfBirth: placeOfBirth.trim(),
    name: typeof name === 'string' ? name.trim() : null,
    gender: typeof gender === 'string' ? gender.trim() : null,
    timezone: typeof timezone === 'string' ? timezone.trim() : null,
    latitude: typeof latitude === 'number' ? latitude : null,
    longitude: typeof longitude === 'number' ? longitude : null,
  };
}

function formatDateToDDMMYYYY(input: string): string {
  const trimmed = input.trim();
  const isoMatch = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(trimmed);
  if (!isoMatch) return trimmed;
  const [, year, month, day] = isoMatch;
  return `${day}-${month}-${year}`;
}

function formatTimeTo12Hour(input: string): string {
  const trimmed = input.trim();
  const match = /^([0-9]{1,2}):([0-9]{2})$/.exec(trimmed);
  if (!match) return trimmed;
  let hours = Number(match[1]);
  const minutes = match[2];
  if (!Number.isFinite(hours) || hours < 0 || hours > 23) return trimmed;
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  const hourStr = hour12.toString().padStart(2, '0');
  return `${hourStr}:${minutes} ${suffix}`;
}

interface KundliResponseShape {
  sun_sign: string;
  moon_sign: string;
  ascendant: string;
  nakshatra: string;
  nakshatra_pada: number;
  ayanamsa: string;
  planetary_longitudes: Record<string, number>;
  confidence: number;
  [key: string]: unknown;
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  if (typeof value !== 'object' || value === null) return false;
  for (const v of Object.values(value as Record<string, unknown>)) {
    if (typeof v !== 'number' || !Number.isFinite(v)) return false;
  }
  return true;
}

function validateKundliResponse(value: unknown): KundliResponseShape {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Kundli data must be an object');
  }

  const obj = value as Record<string, unknown>;

  const requiredStringFields = [
    'sun_sign',
    'moon_sign',
    'ascendant',
    'nakshatra',
    'ayanamsa',
  ] as const;

  const missingStrings = requiredStringFields.filter(
    (field) => !isNonEmptyString(obj[field]),
  );
  if (missingStrings.length > 0) {
    throw new Error(
      `Kundli is missing required string fields: ${missingStrings.join(', ')}`,
    );
  }

  if (typeof obj.nakshatra_pada !== 'number' || !Number.isFinite(obj.nakshatra_pada)) {
    throw new Error('Kundli.nakshatra_pada must be a finite number');
  }

  if (typeof obj.confidence !== 'number' || !Number.isFinite(obj.confidence)) {
    throw new Error('Kundli.confidence must be a finite number');
  }

  if (!isNumberRecord(obj.planetary_longitudes)) {
    throw new Error('Kundli.planetary_longitudes must be an object of numbers');
  }

  return obj as KundliResponseShape;
}

const ENGINE_URL = 'https://astro-api-a3kq.onrender.com/generate-kundli';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.json();
    let incomingBody: IncomingRequestBody;

    try {
      incomingBody = validateEngineRequestBody(rawBody);
    } catch (validationError) {
      console.error('Invalid kundli request body:', validationError);
      return new Response(
        JSON.stringify({
          error:
            validationError instanceof Error
              ? validationError.message
              : 'Invalid request body',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const timezone = incomingBody.timezone && incomingBody.timezone.length > 0
      ? incomingBody.timezone
      : 'Asia/Kolkata';

    const latitude = typeof incomingBody.latitude === 'number'
      ? incomingBody.latitude
      : 30.2110;

    const longitude = typeof incomingBody.longitude === 'number'
      ? incomingBody.longitude
      : 74.9455;

    const enginePayload: EngineRequestPayload = {
      date: formatDateToDDMMYYYY(incomingBody.dateOfBirth),
      time: formatTimeTo12Hour(incomingBody.timeOfBirth),
      timezone,
      latitude,
      longitude,
      name: incomingBody.name ?? null,
      gender: incomingBody.gender ?? null,
    };

    console.log('Calling external Kundli engine at', ENGINE_URL);

    const engineResponse = await fetch(ENGINE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(enginePayload),
    });

    if (!engineResponse.ok) {
      const errorText = await engineResponse.text();
      console.error(
        'Kundli engine error:',
        engineResponse.status,
        errorText,
      );

      const statusCode =
        engineResponse.status >= 400 && engineResponse.status < 500
          ? engineResponse.status
          : 502;

      return new Response(
        JSON.stringify({
          error:
            statusCode === 502
              ? 'Failed to generate kundli from external engine'
              : 'Kundli engine rejected the request',
          details: errorText,
        }),
        {
          status: statusCode,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    let engineJson: unknown;
    try {
      engineJson = await engineResponse.json();
    } catch (e) {
      console.error('Failed to parse Kundli engine JSON:', e);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON returned by Kundli engine' }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    let kundli: KundliResponseShape;
    try {
      kundli = validateKundliResponse(engineJson);
    } catch (e) {
      console.error('Kundli validation failed:', e);
      return new Response(
        JSON.stringify({
          error: 'Invalid kundli format received from engine',
          details: e instanceof Error ? e.message : String(e),
        }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    console.log('Kundli generated successfully via external engine');

    return new Response(JSON.stringify({ kundli }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-kundli function:', error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : 'Unknown error in edge function',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
