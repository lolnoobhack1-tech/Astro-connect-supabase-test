import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 1. POINT TO YOUR NEW PYTHON BACKEND
const PYTHON_API_URL = "https://astro-api-a3kq.onrender.com/calculate-compatibility";

// Normalise nakshatra names to the exact enum expected by the Python API
function normaliseNakshatra(value: any): string | undefined {
  if (!value || typeof value !== "string") return value;
  // Our kundli engine sometimes returns "Mrigashirsha" while the
  // compatibility engine expects "Mrigashira".
  if (value === "Mrigashirsha") return "Mrigashira";
  return value;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user1Id, user2Id } = await req.json();

    // 2. VALIDATE INPUT
    if (!user1Id || !user2Id) {
      return new Response(JSON.stringify({ error: "Missing user IDs" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. INIT SUPABASE
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 4. FETCH STORED KUNDLI DATA
    // We need the raw JSON to extract Moon Sign & Nakshatra
    const { data: k1Data } = await supabase
      .from("kundli_data")
      .select("kundli_json")
      .eq("user_id", user1Id)
      .maybeSingle();

    const { data: k2Data } = await supabase
      .from("kundli_data")
      .select("kundli_json")
      .eq("user_id", user2Id)
      .maybeSingle();

    if (!k1Data || !k2Data) {
      console.warn("Kundli data not found for one or both users", { user1Id, user2Id });
      // Gracefully return a non-fatal response so the frontend can skip this match
      return new Response(
        JSON.stringify({
          error: "Kundli data not found for one or both users",
          missing_kundli: true,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const p1 = k1Data.kundli_json;
    const p2 = k2Data.kundli_json;

    // 5. EXTRACT EXACTLY WHAT PYTHON NEEDS
    // We Map 'p1' -> 'Bride' and 'p2' -> 'Groom' strict structure
    const pythonPayload = {
      bride: {
        moon_sign: p1.moon_sign || p1.moon?.sign, // Handle different JSON structures
        nakshatra: normaliseNakshatra(p1.nakshatra || p1.moon?.nakshatra),
      },
      groom: {
        moon_sign: p2.moon_sign || p2.moon?.sign,
        nakshatra: normaliseNakshatra(p2.nakshatra || p2.moon?.nakshatra),
      },
    };

    console.log("Calling Python API with:", JSON.stringify(pythonPayload));

    // 6. CALL PYTHON API (Parāśara Logic)
    const pyResponse = await fetch(PYTHON_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pythonPayload),
    });

    if (!pyResponse.ok) {
      const errText = await pyResponse.text();
      console.error("Python API Error:", pyResponse.status, errText);
      return new Response(JSON.stringify({ error: "Calculation Engine Failed", details: errText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await pyResponse.json();

    // 7. SAVE RESULT TO DB
    const { error: insertError } = await supabase.from("compatibility_scores").insert({
      user1_id: user1Id,
      user2_id: user2Id,
      score: result.total_gunas, // Strict Integer
      details: result, // Full breakdown
    });

    if (insertError) {
      console.error("Failed to store compatibility:", insertError);
    }

    // 8. RETURN SUCCESS
    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error in calculate-compatibility:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
