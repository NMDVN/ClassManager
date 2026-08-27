interface Env {
  MISTRAL_API_KEY?: string;
}

export const onRequestGet = async (context: { env: Env }) => {
  const hasEnvApiKey = Boolean(
    context.env.MISTRAL_API_KEY && context.env.MISTRAL_API_KEY.trim() !== ""
  );

  return new Response(
    JSON.stringify({
      hasEnvApiKey,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
};
