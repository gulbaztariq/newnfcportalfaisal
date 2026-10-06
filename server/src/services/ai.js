/*
 * AI writing assistant (Claude). Used for: AI-generated vCards, vCard / service / product / store product descriptions.
 * Key: Settings > AI (anthropic_api_key) or the ANTHROPIC_API_KEY environment variable.
 * Uses claude-opus-5 with server-side refusal fallbacks ("default" routing) and JSON structured outputs.
 */
const Anthropic = require('@anthropic-ai/sdk');
const settings = require('./settings');
const { HttpError } = require('../utils/http');

const MODEL = 'claude-opus-5';

async function client() {
  const s = await settings.all();
  if (s.ai_enable !== '1') throw new HttpError(422, 'AI features are disabled by the administrator');
  const apiKey = s.anthropic_api_key || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new HttpError(422, 'AI is not configured yet (missing Anthropic API key)');
  return new Anthropic({ apiKey, timeout: 180_000 });
}

/** One structured-output call; returns the parsed JSON object. */
async function generateJson(system, prompt, schema, maxTokens = 4000, effort = 'low') {
  const c = await client();
  let response;
  try {
    response = await c.beta.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort, format: { type: 'json_schema', schema } },
      system,
      messages: [{ role: 'user', content: prompt }],
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new HttpError(422, 'The Anthropic API key is invalid');
    if (e instanceof Anthropic.RateLimitError) throw new HttpError(429, 'The AI service is busy, please try again in a moment');
    if (e instanceof Anthropic.APIError) throw new HttpError(502, `AI error: ${e.message}`);
    throw e;
  }
  if (response.stop_reason === 'refusal') throw new HttpError(422, 'The AI could not help with this request. Please rephrase it.');
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  try { return JSON.parse(text); } catch { throw new HttpError(502, 'The AI returned an unexpected answer, please try again'); }
}

const SYSTEM = 'You write concise, professional, friendly copy for digital business cards (vCards) and small online stores. Write in the language the user asks for (default English). Never invent contact details, prices, awards or statistics. Keep it truthful to the brief.';

const str = (d) => ({ type: 'string', description: d });

/** Full vCard draft from a short brief */
function vcardDraft({ name, profession, company, brief, language = 'English' }) {
  return generateJson(SYSTEM, `Create a digital business card draft.
Name: ${name || '-'}
Profession: ${profession || '-'}
Company: ${company || '-'}
About them (their own words): ${brief || '-'}
Language: ${language}
Return: an occupation title, a 2-3 sentence first-person "about" description, 3-4 services they likely offer (name + one sentence), and a colour palette (hex primary/secondary/background/text) that suits the profession.`, {
    type: 'object',
    additionalProperties: false,
    required: ['occupation', 'description', 'services', 'theme'],
    properties: {
      occupation: str('Job title shown under the name'),
      description: str('2-3 sentence first-person bio'),
      services: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'description'], properties: { name: str('Service name'), description: str('One sentence') } } },
      theme: { type: 'object', additionalProperties: false, required: ['primary', 'secondary', 'background', 'text'], properties: { primary: str('#rrggbb'), secondary: str('#rrggbb'), background: str('#rrggbb light or dark page background'), text: str('#rrggbb readable on background') } },
    },
  });
}

/** Short description for a vCard / service / product / store product */
async function describe({ kind = 'product', title, details, tone = 'professional', language = 'English' }) {
  const r = await generateJson(SYSTEM, `Write a ${tone} description for a ${kind} named "${title}". Details: ${details || '-'}. Language: ${language}. 40-80 words, no headings, no emojis.`, {
    type: 'object', additionalProperties: false, required: ['description'], properties: { description: str('The description text') },
  });
  return r.description;
}

/** Printable NFC card design (front + back) as SVG, CR80 card at 1011 x 638 units (85.6 x 54 mm @ 300 dpi) */
async function cardDesign({ name, title, company, phone, email, website, style, colors, prompt, product = 'NFC business card' }) {
  const r = await generateJson(
    'You are a senior print designer. You design premium, modern, minimal NFC business cards and NFC review cards as clean SVG. '
    + 'Rules: output only self-contained SVG markup with viewBox="0 0 1011 638" (landscape card, 3 mm safe margin = 36 units, keep text inside), '
    + 'use only <svg> <g> <rect> <circle> <ellipse> <line> <polyline> <polygon> <path> <text> <tspan> <defs> <linearGradient> <radialGradient> <stop> <clipPath>, '
    + 'no <image>, no <script>, no <foreignObject>, no external fonts or links, font-family limited to Arial, Helvetica, Georgia, "Times New Roman", Verdana, sans-serif or serif. '
    + 'Put a small NFC/contactless symbol (four curved lines) on one side. Leave a 180x180 unit empty square on the back side for a QR code, marked with a thin rounded outline and the label "SCAN ME". '
    + 'Never invent contact details: use exactly the ones given, skip the empty ones.',
    `Design a ${product}.
Name: ${name || '-'}
Title: ${title || '-'}
Company / brand: ${company || '-'}
Phone: ${phone || '-'}
E-mail: ${email || '-'}
Website: ${website || '-'}
Style: ${style || 'modern minimal'}
Colours: ${colors || 'designer choice'}
Extra wishes from the customer: ${prompt || '-'}
Return the front side, the back side and a one-sentence description of the concept.`,
    {
      type: 'object', additionalProperties: false, required: ['front_svg', 'back_svg', 'concept'],
      properties: { front_svg: str('Complete <svg ...>...</svg> for the front'), back_svg: str('Complete <svg ...>...</svg> for the back'), concept: str('One sentence') },
    },
    12000, 'medium',
  );
  return r;
}

module.exports = { vcardDraft, describe, cardDesign, MODEL };
