// Folha Semanal — função "reunioes"
// Transcreve partes de áudio de reunião com o Voxtral (Mistral) e gera o relatório
// (resumo, pautas, decisões, pendências e memória da reunião) com um modelo de texto do Mistral.
// A chave fica no segredo MISTRAL_API_KEY do projeto; nunca vai para o navegador.
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const STT_MODEL = Deno.env.get("MISTRAL_STT_MODEL") || "voxtral-mini-latest";
const LLM_MODEL = Deno.env.get("MISTRAL_LLM_MODEL") || "mistral-medium-latest";

function fmt(s: number) {
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}

async function transcribe(key: string, blob: Blob, name: string, offsetSec: number) {
  const send = async (diarize: boolean) => {
    const fd = new FormData();
    fd.append("model", STT_MODEL);
    fd.append("file", blob, name);
    if (diarize) {
      fd.append("diarize", "true");
      fd.append("timestamp_granularities", "segment");
    } else {
      fd.append("language", "pt");
    }
    const r = await fetch("https://api.mistral.ai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: fd,
    });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, j };
  };
  let res = await send(true);
  if (!res.ok && res.status >= 400 && res.status < 500 && res.status !== 401) res = await send(false);
  if (!res.ok) throw { status: res.status, detail: res.j };
  const segs = Array.isArray(res.j.segments) ? res.j.segments : [];
  const spk = (s: Record<string, unknown>) => s.speaker ?? s.speaker_id ?? s.speaker_label;
  if (segs.length && segs.some((s: Record<string, unknown>) => spk(s) != null)) {
    const lines: string[] = [];
    let last: unknown = undefined;
    for (const s of segs) {
      const who = spk(s);
      const t = String(s.text ?? "").trim();
      if (!t) continue;
      const at = typeof s.start === "number" ? ` [${fmt(offsetSec + s.start)}]` : "";
      if (who !== last) {
        lines.push(`\n${who != null ? "Pessoa " + (typeof who === "number" ? who + 1 : String(who).replace(/\D+/g, "") || who) : "Fala"}${at}: ${t}`);
        last = who;
      } else lines[lines.length - 1] += " " + t;
    }
    return { text: lines.join("").trim(), speakers: true, seconds: res.j.usage?.prompt_audio_seconds ?? null };
  }
  return { text: String(res.j.text ?? "").trim(), speakers: false, seconds: res.j.usage?.prompt_audio_seconds ?? null };
}

const SCHEMA = `{
  "titulo": "assunto da reunião em poucas palavras",
  "resumo": "3 a 6 frases com o essencial",
  "participantes": ["nomes e/ou funções citados"],
  "pautas": [{"tema": "tema", "discussao": "o que foi dito sobre o tema, em 2 a 5 frases"}],
  "decisoes": ["o que ficou decidido/deliberado"],
  "pendencias": [{"acao": "o que precisa ser feito", "responsavel": "quem, ou null", "prazo": "AAAA-MM-DD ou null", "prazo_texto": "como o prazo foi dito, ou null"}],
  "proxima_reuniao": "data/hora/local se combinados, ou null",
  "observacoes": "pontos de atenção, ou null"
}`;

async function summarize(key: string, transcript: string, meta: Record<string, unknown>) {
  const sys = `Você é responsável por registrar reuniões de trabalho de uma equipe do serviço público (assistência social), no Brasil.
Leia a transcrição e devolva SOMENTE um objeto JSON válido, em português do Brasil, neste formato:
${SCHEMA}
Regras:
- Use apenas o que está na transcrição e nos dados informados. Não invente nomes, números, datas ou decisões.
- A transcrição pode ter erros de reconhecimento de fala; corrija palavras óbvias pelo contexto, sem mudar o sentido.
- Os falantes podem aparecer como "Pessoa 1", "Pessoa 2"; se o nome de alguém for dito, use o nome.
- Prazos relativos ("sexta que vem", "até o fim do mês") devem ser convertidos para AAAA-MM-DD usando a data da reunião informada. Se não houver prazo, use null.
- Escreva de forma objetiva e impessoal, adequada a uma memória de reunião oficial.
- Listas vazias quando não houver itens.`;
  const user = `Dados da reunião:
- Data: ${meta.data ?? "não informada"}
- Horário: ${meta.horario ?? "não informado"}
- Local: ${meta.local || "não informado"}
- Assunto informado: ${meta.titulo || "não informado"}
- Participantes informados: ${meta.participantes || "não informados"}

Transcrição:
"""
${transcript}
"""`;
  const r = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: LLM_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: sys }, { role: "user", content: user }],
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw { status: r.status, detail: j };
  const raw = j.choices?.[0]?.message?.content ?? "{}";
  const txt = Array.isArray(raw) ? raw.map((c: Record<string, unknown>) => c.text ?? "").join("") : String(raw);
  const m = txt.match(/\{[\s\S]*\}/);
  return JSON.parse(m ? m[0] : txt);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const apikey = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, apikey, {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false },
    });
    const { data: { user } } = await sb.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
    if (!user) return json({ error: "not_authenticated" }, 401);
    const key = Deno.env.get("MISTRAL_API_KEY");
    if (!key) return json({ error: "missing_key" }, 500);
    const body = await req.json();

    if (body.action === "ping") return json({ ok: true });

    if (body.action === "transcribe") {
      const path = String(body.path ?? "");
      if (!path.startsWith(user.id + "/")) return json({ error: "forbidden" }, 403);
      const dl = await sb.storage.from("anexos").download(path);
      if (dl.error || !dl.data) return json({ error: "download_failed", detail: dl.error?.message }, 400);
      const out = await transcribe(key, dl.data, path.split("/").pop() || "audio.mp3", Number(body.offset) || 0);
      return json(out);
    }

    if (body.action === "summarize") {
      const transcript = String(body.transcript ?? "").slice(0, 400000);
      if (transcript.trim().length < 20) return json({ error: "empty_transcript" }, 400);
      const report = await summarize(key, transcript, body.meta ?? {});
      return json({ report });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    const err = e as { status?: number; detail?: unknown };
    if (err && err.status) {
      const code = err.status === 401 ? "mistral_key_invalid" : err.status === 429 ? "mistral_rate_limit" : err.status === 402 ? "mistral_billing" : "mistral_error";
      return json({ error: code, status: err.status, detail: err.detail }, 502);
    }
    return json({ error: "server_error", detail: String(e) }, 500);
  }
});
