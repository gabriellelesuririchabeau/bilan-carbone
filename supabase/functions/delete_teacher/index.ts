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
      headers: corsHeaders,
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

    const { data: authData } = await supabaseAdmin.auth.getUser(jwt);

    if (!authData?.user) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const requesterId = authData.user.id;

    const { data: requesterProfile } = await supabaseAdmin
      .from("user_profiles")
      .select("role")
      .eq("user_id", requesterId)
      .maybeSingle();

    if (!requesterProfile || requesterProfile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Accès refusé" }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    const { user_id } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id requis" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Vérifier que c’est un teacher
    const { data: target } = await supabaseAdmin
      .from("user_profiles")
      .select("role")
      .eq("user_id", user_id)
      .maybeSingle();

    if (!target || target.role !== "teacher") {
      return new Response(JSON.stringify({ error: "Utilisateur invalide" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Supprimer profil
    await supabaseAdmin
      .from("user_profiles")
      .delete()
      .eq("user_id", user_id);

    // Supprimer auth
    await supabaseAdmin.auth.admin.deleteUser(user_id);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});