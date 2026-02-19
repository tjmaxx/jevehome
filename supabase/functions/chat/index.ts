/**
 * chat/index.ts
 *
 * Supabase Edge Function — AI chat endpoint for the Jeve Home assistant widget.
 *
 * Adapted from jevehome-agent/server/services/gemini.js and
 * jevehome-agent/server/routes/chat.js.
 *
 * Configuration is loaded at request time from the `agent_config` table,
 * allowing the admin to change model, prompt, tools and theme without redeployment.
 *
 * Environment secrets required (set via `supabase secrets set`):
 *   GEMINI_API_KEY  — Google Generative AI API key
 *
 * Supabase automatically injects:
 *   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai';

const DEFAULT_MODEL = 'gemini-2.5-flash-lite';
const CHAT_TIMEOUT_MS = 120_000; // 2 minutes

// ── Default system prompt (used when admin hasn't set a custom one) ────────────

const DEFAULT_SYSTEM_PROMPT = `You are a warm, loving assistant embedded in a private anniversary website — a site built to celebrate a couple's journey of love, laughter, and family.

ABOUT THE SITE:
The site is presented to outsiders as "Jeve Home", a fictional interior design studio. But once logged in, it reveals the real content: a heartfelt anniversary website complete with:
- A yearly timeline of milestones and memories (2011–2026)
- A private photo gallery of their life together
- "One Day One Word" — a section where they write one loving word to each other each day
- A final message section filled with love letters

YOUR ROLE:
- Answer questions about the couple's love story, the timeline, photos, site sections, and family warmly and affectionately
- Help with general questions as a knowledgeable, caring assistant
- Keep responses concise and heartfelt
- If asked about interior design (the fake company), play along lightheartedly
- Speak with warmth, as if you are a trusted friend of the family

Be conversational, loving, and helpful. You are part of something special.`;

// Timeline context injected when the timeline_context tool is enabled.
// These are the default descriptions from the site (same as main.js TIMELINE_DEFAULTS).
// Admin-overridden entries from site_config are merged in at runtime by buildTimelineContext().
const TIMELINE_DEFAULTS: Record<number, { title: string; desc: string }> = {
  2011: { title: 'Where It All Began',    desc: 'Two students crossed paths at Virginia Tech. A chance meeting that would change everything. Little did we know, this was the start of our forever.' },
  2012: { title: 'Long Distance Love',    desc: 'Miles apart — Virginia Tech and Washington DC. Distance tested us, but our love only grew stronger. Every visit, every call, every moment apart made our hearts fonder.' },
  2013: { title: 'Together Again',        desc: 'Finally reunited! No more counting down the days. Being together felt like coming home. Our love had weathered the distance and emerged even stronger.' },
  2014: { title: 'Building Our Future',   desc: 'A year of dreams taking shape. Late night talks about forever, planning our lives together. We knew we were ready for the next chapter.' },
  2015: { title: 'Married!',              desc: 'Their February wedding marked the beginning of forever. Two hearts, one journey.' },
  2016: { title: 'Eric Tang Arrives',     desc: 'A tiny miracle joined the family. Their hearts expanded in ways they never imagined possible. Parenthood changed everything beautifully.' },
  2017: { title: 'Adventures as Three',   desc: 'Exploring life together as a family, creating memories, and watching Eric discover the world.' },
  2018: { title: 'Growing Together',      desc: 'Learning, loving, and building the foundation for their growing family.' },
  2019: { title: 'Ella Tang Joins Us',    desc: 'The family became complete with the arrival of their second little one. Four hearts beating as one.' },
  2020: { title: 'Staying Strong',        desc: 'A challenging year brought them closer. Home became their sanctuary, family their strength.' },
  2021: { title: 'A Family of Four',      desc: 'Watching their kids grow together, filling their home with laughter and love.' },
  2022: { title: 'Making Memories',       desc: 'From park days to cozy evenings at home, every moment became precious.' },
  2023: { title: 'Exploring New Places',  desc: 'Family adventures near and far — every day is a gift they cherish together.' },
  2024: { title: 'Stronger Than Ever',    desc: 'Nearly a decade of love, growth, and family. Building traditions that will last generations.' },
  2025: { title: 'A Decade of Love',      desc: 'Ten incredible years together. Looking back at how far they\'ve come, grateful for every moment.' },
  2026: { title: '11 Years & Forever',    desc: 'Eleven years of marriage, love, and family. Here\'s to the next eleven, and all the years after that.' },
};

// Builds the timeline context string, merging DB overrides over defaults.
function buildTimelineContext(siteConfig: Record<string, string>): string {
  const years = Object.keys(TIMELINE_DEFAULTS).map(Number).sort();
  const lines = years.map(year => {
    const def = TIMELINE_DEFAULTS[year];
    const title = siteConfig[`timeline_${year}_title`] || def.title;
    const desc  = siteConfig[`timeline_${year}_desc`]  || def.desc;
    return `- ${year}: ${title} — ${desc}`;
  });
  return '\n\nANNIVERSARY TIMELINE (year by year):\n' + lines.join('\n');
}

// ── Config loader ─────────────────────────────────────────────────────────────

interface AgentConfig {
  model: string;
  systemPrompt: string;
  siteContext: string;
  maxHistory: number;
  enabledTools: string[];
  siteConfig: Record<string, string>; // timeline overrides from site_config table
}

async function loadConfig(serviceClient: ReturnType<typeof createClient>): Promise<AgentConfig> {
  try {
    // Load agent_config and site_config in parallel
    const [agentRes, siteRes] = await Promise.all([
      serviceClient.from('agent_config').select('key, value'),
      serviceClient.from('site_config').select('config_key, config_value'),
    ]);

    const map: Record<string, string> = {};
    if (agentRes.data) {
      for (const row of agentRes.data) map[row.key] = row.value;
    }

    const siteConfig: Record<string, string> = {};
    if (siteRes.data) {
      for (const row of siteRes.data) siteConfig[row.config_key] = row.config_value;
    }

    const enabledTools: string[] = (() => {
      try { return JSON.parse(map.enabled_tools || '[]'); } catch { return []; }
    })();

    return {
      model:        map.model || DEFAULT_MODEL,
      systemPrompt: map.system_prompt || '',
      siteContext:  map.site_context  || '',
      maxHistory:   parseInt(map.max_history || '20', 10),
      enabledTools,
      siteConfig,
    };
  } catch (e) {
    console.error('[Config] Failed to load config:', e);
    return { model: DEFAULT_MODEL, systemPrompt: '', siteContext: '', maxHistory: 20, enabledTools: [], siteConfig: {} };
  }
}

// ── Gemini helpers (adapted from jevehome-agent/server/services/gemini.js) ────

function buildSystemPrompt(config: AgentConfig): string {
  const base = config.systemPrompt.trim() || DEFAULT_SYSTEM_PROMPT;
  const allowGeneral = config.enabledTools.includes('general_knowledge');
  const includeTimeline = config.enabledTools.includes('timeline_context');

  let prompt = base;

  // Append site context (family/couple details) — always included when set by admin
  if (config.siteContext.trim()) {
    prompt += '\n\nSITE CONTEXT (about the family and couple):\n' + config.siteContext.trim();
  }

  // Append full timeline with DB overrides merged in
  if (includeTimeline) {
    prompt += buildTimelineContext(config.siteConfig);
  }

  if (!allowGeneral) {
    prompt += '\n\nIMPORTANT: Keep all responses focused on this anniversary site, their love story, and the site\'s features. Politely redirect off-topic questions.';
  }

  return prompt;
}

function buildHistory(messages: Array<{ role: string; content: string }>, maxHistory: number) {
  return messages.slice(-maxHistory).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
}

// ── Edge Function handler ─────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  }

  // ── Auth ─────────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  }
  const token = authHeader.slice(7);

  const supabaseUrl      = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey  = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient    = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  }

  // ── Parse body ────────────────────────────────────────────────────────────────
  let body: { conversationId?: string; message?: string; enabledTools?: string[] };
  try { body = await req.json(); }
  catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  }

  const { conversationId, message, enabledTools: clientTools } = body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return new Response(JSON.stringify({ error: 'Message is required.' }), {
      status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  }
  if (message.trim().length > 4000) {
    return new Response(JSON.stringify({ error: 'Message too long (max 4000 characters).' }), {
      status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  }

  const trimmed = message.trim();

  // ── Load config from DB ───────────────────────────────────────────────────────
  const config = await loadConfig(serviceClient);
  // Client-provided enabledTools override DB config (client knows what admin set)
  if (Array.isArray(clientTools) && clientTools.length > 0) {
    config.enabledTools = clientTools;
  }

  // ── Conversation management ───────────────────────────────────────────────────
  let convId = conversationId || '';
  let isNew  = false;

  if (!convId) {
    const { data: conv, error } = await userClient
      .from('agent_conversations')
      .insert({ user_id: user.id })
      .select('id')
      .single();

    if (error || !conv) {
      return new Response(JSON.stringify({ error: 'Failed to start conversation.' }), {
        status: 500, headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
    }
    convId = conv.id;
    isNew  = true;
  } else {
    const { data: conv } = await userClient
      .from('agent_conversations')
      .select('id')
      .eq('id', convId)
      .single();

    if (!conv) {
      return new Response(JSON.stringify({ error: 'Conversation not found.' }), {
        status: 404, headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
    }
  }

  // Load conversation history (skipped if conversation_history tool is disabled)
  const useHistory = config.enabledTools.includes('conversation_history');
  let historyRows: Array<{ role: string; content: string }> = [];

  if (useHistory) {
    const { data } = await userClient
      .from('agent_messages')
      .select('role, content')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
      .limit(config.maxHistory);
    historyRows = data || [];
  }

  // Save user message
  await userClient.from('agent_messages').insert({
    conversation_id: convId,
    role: 'user',
    content: trimmed,
  });

  // ── SSE streaming response ────────────────────────────────────────────────────
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (data: Record<string, unknown>) => {
        try {
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        } catch { /* client disconnected */ }
      };

      const timeoutId = setTimeout(() => {
        emit({ type: 'error', error: 'Request timed out.' });
        controller.close();
      }, CHAT_TIMEOUT_MS);

      try {
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) throw new Error('GEMINI_API_KEY is not configured.');

        const genAI = new GoogleGenerativeAI(geminiApiKey);
        const model = genAI.getGenerativeModel({
          model: config.model,
          systemInstruction: buildSystemPrompt(config),
        });

        const history  = buildHistory(historyRows, config.maxHistory);
        const chatSession = model.startChat({ history });

        const streamResult = await chatSession.sendMessageStream(trimmed);

        let fullReply = '';
        for await (const chunk of streamResult.stream) {
          const text = chunk.text();
          if (text) {
            fullReply += text;
            emit({ type: 'chunk', text });
          }
        }

        // Persist assistant reply
        await userClient.from('agent_messages').insert({
          conversation_id: convId,
          role: 'assistant',
          content: fullReply || 'I had trouble generating a response. Please try again.',
        });

        // Update conversation timestamp
        await serviceClient
          .from('agent_conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', convId);

        // Auto-generate title for new conversations
        if (isNew && fullReply) {
          generateTitle(genAI, config.model, trimmed, fullReply)
            .then(title => serviceClient.from('agent_conversations').update({ title }).eq('id', convId))
            .catch(e => console.error('[Title]', e.message));
        }

        emit({ type: 'done', conversationId: convId, isNew });

      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.error('[Chat]', msg);
        emit({ type: 'error', error: msg });
      } finally {
        clearTimeout(timeoutId);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      ...corsHeaders(),
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function generateTitle(
  genAI: GoogleGenerativeAI,
  modelName: string,
  firstMessage: string,
  firstResponse: string
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: modelName });
  const prompt = `Generate a very short title (3–5 words) for this conversation:
User: ${firstMessage.substring(0, 200)}
Assistant: ${firstResponse.substring(0, 200)}
Return only the title, nothing else.`;
  const result = await model.generateContent(prompt);
  return result.response.text().trim().slice(0, 60);
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  };
}
