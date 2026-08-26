import { createClient } from "@supabase/supabase-js";

const verifiedContexts = new WeakSet();

function requireEnvironment() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing required Supabase environment variables: SUPABASE_URL and SUPABASE_ANON_KEY"
    );
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
  };
}

function requireAccessToken(accessToken) {
  if (typeof accessToken !== "string" || accessToken.trim() === "") {
    throw new Error("Missing participant access token");
  }

  return accessToken.trim();
}

export async function createAuthenticatedSupabaseContext(accessToken) {
  const token = requireAccessToken(accessToken);
  const { supabaseUrl, supabaseAnonKey } = requireEnvironment();

  const supabase = createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );

  const {
    data,
    error,
  } = await supabase.auth.getUser(token);

  const user = data?.user;

  if (
    error ||
    !user ||
    typeof user.id !== "string" ||
    user.id.trim() === ""
  ) {
    throw new Error(
      "Unable to verify authenticated Supabase user"
    );
  }

  const context = Object.freeze({
    supabase,
    user: Object.freeze({ ...user }),
    ownerId: user.id.trim(),
  });

  verifiedContexts.add(context);

  return context;
}

export function requireVerifiedSupabaseContext(context) {
  if (
    !context ||
    typeof context !== "object" ||
    !verifiedContexts.has(context)
  ) {
    throw new Error(
      "A verified authenticated Supabase context is required"
    );
  }

  return context;
}