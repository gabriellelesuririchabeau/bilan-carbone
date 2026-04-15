// @ts-nocheck
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Content-Type": "text/plain",
      },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authorization requise" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const jwt = authHeader.replace("Bearer ", "").trim();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(jwt);

    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: "Utilisateur non authentifié" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const requesterId = authData.user.id;

    const { data: requesterProfile, error: requesterError } = await supabaseAdmin
      .from("user_profiles")
      .select("role")
      .eq("user_id", requesterId)
      .maybeSingle();

    if (requesterError) {
      return new Response(JSON.stringify({ error: requesterError.message }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (!requesterProfile || requesterProfile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Accès refusé" }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    const { email, password, name } = await req.json();

    if (!email || !password || !name) {
      return new Response(JSON.stringify({ error: "Nom, email et mot de passe requis" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const { data: newUser, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const { error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .insert({
        user_id: newUser.user.id,
        email,
        name,
        role: "teacher",
        is_active: true,
      });

    if (profileError) {
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erreur serveur" }),
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
});