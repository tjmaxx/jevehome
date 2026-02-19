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

const DEFAULT_SYSTEM_PROMPT = `You are a warm, loving assistant embedded in Jia & Vickey's private anniversary website — a site they built to celebrate over 11 years of marriage.

ABOUT THE SITE:
The site is presented to outsiders as "Jeve Home", a fictional interior design studio. But once logged in, it reveals the real content: a heartfelt anniversary website for Jia & Vickey, complete with:
- A yearly timeline of milestones and memories (2011–2026)
- A private photo gallery of their life together
- "One Day One Word" — a section where they write one loving word to each other each day
- A final message section filled with love letters

ABOUT JIA & VICKEY:
- They have been together for over 11 years and married since 2015
- Their anniversary site is a labor of love built to surprise and cherish each other
- They share a home and a life built on kindness, humor, and deep affection

YOUR ROLE:
- Answer questions about their love story, the timeline, photos, or site sections warmly and affectionately
- Help with general questions as a knowledgeable, caring assistant
- Keep responses concise and heartfelt
- If asked about interior design (the fake company), play along lightheartedly
- Speak with warmth, as if you are a trusted friend of the couple

Be conversational, loving, and helpful. You are part of something special.`;

// Timeline context injected when the timeline_context tool is enabled
const TIMELINE_CONTEXT = `

ANNIVERSARY TIMELINE (key milestones):
- 2011: Where it all began — they first met and fell in love
- 2012: Growing closer — deepening their connection
- 2013: Adventures together — exploring life as a couple
- 2014: Building a future — serious commitment, planning ahead
- 2015: Marriage — they tied the knot and began their married life
- 2016: First year of marriage — learning and growing together
- 2017: New adventures — building their shared home and routines
- 2018: Deepening bonds — travel, milestones, cherished memories
- 2019: Together through everything — supporting each other
- 2020: Resilience — navigating challenges hand in hand
- 2021: Renewal — rediscovering joy and each other
- 2022: Flourishing — professionally and personally thriving
- 2023: Gratitude — reflecting on how far they've come
- 2024: A decade+ — celebrating ten-plus years of love
- 2025: Still going strong — deeper love than ever
- 2026: Anniversary site launch — this very site, a gift of love`;

// ── Config loader ─────────────────────────────────────────────────────────────

interface AgentConfig {
  model: string;
  systemPrompt: string;
  maxHistory: number;
  enabledTools: string[];
}

async function loadConfig(serviceClient: ReturnType<typeof createClient>): Promise<AgentConfig> {
  try {
    const { data } = await serviceClient
      .from('agent_config')
      .select('key, value');

    const map: Record<string, string> = {};
    if (data) {
      for (const row of data) map[row.key] = row.value;
    }

    const enabledTools: string[] = (() => {
      try { return JSON.parse(map.enabled_tools || '[]'); } catch { return []; }
    })();

    return {
      model:        map.model || DEFAULT_MODEL,
      systemPrompt: map.system_prompt || '',
      maxHistory:   parseInt(map.max_history || '20', 10),
      enabledTools,
    };
  } catch (e) {
    console.error('[Config] Failed to load agent_config:', e);
    return { model: DEFAULT_MODEL, systemPrompt: '', maxHistory: 20, enabledTools: [] };
  }
}

// ── Gemini helpers (adapted from jevehome-agent/server/services/gemini.js) ────

function buildSystemPrompt(config: AgentConfig): string {
  const base = config.systemPrompt.trim() || DEFAULT_SYSTEM_PROMPT;
  const allowGeneral = config.enabledTools.includes('general_knowledge');
  const includeTimeline = config.enabledTools.includes('timeline_context');

  let prompt = base;

  if (includeTimeline) {
    prompt += TIMELINE_CONTEXT;
  }

  if (!allowGeneral) {
    prompt += '\n\nIMPORTANT: Keep all responses focused on Jia & Vickey\'s anniversary site, their love story, and the site\'s features. Politely redirect off-topic questions.';
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
