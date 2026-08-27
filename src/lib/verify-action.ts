import OpenAI from 'openai'

const openai = new OpenAI()
const MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'

export interface VerifyAssessment {
  needsHumanVerification: boolean
  confidence: number
  reasoning: string
  verificationQuestion: string
}

const SYSTEM_PROMPT = `You are Trustact, a verification co-pilot for autonomous AI agents
(shopping agents, booking agents, concierge agents) that are about to spend real money
on someone's behalf.

A human will describe an action the agent is about to take (e.g. "book a table at
Cafe Luna for 7pm tonight", "buy the last pair of size 10 sneakers from this listing").

Your job: assess whether the agent can safely proceed on its own knowledge, or whether
it depends on a real-world, real-time fact that you cannot know (store hours right now,
current stock, whether a listing is still live, current local conditions) and that a
real human should verify before the agent commits money.

Respond with ONLY valid JSON (no markdown fences, no commentary) matching this shape:

{
  "needsHumanVerification": true | false,
  "confidence": <0-100, how confident the agent can be WITHOUT a human check>,
  "reasoning": "one or two sentences explaining the assessment",
  "verificationQuestion": "the exact yes/no question a nearby human should answer, or empty string if not needed"
}

Only flag needsHumanVerification=true for facts that are genuinely real-time/local/ephemeral
and impossible to know from training data — not for things you could reasonably infer.

Examples that SHOULD need verification: "is this specific place open right now",
"is there actually a line right now", "is this listing still available", "does this
address exist" — anything about the current, present-moment state of a real-world place
or thing. Examples that should NOT need verification: general facts, typical business
hours in general, how to fill out a form, anything answerable from general knowledge.`

export async function assessAgentAction(action: string): Promise<VerifyAssessment> {
  const completion = await openai.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Agent action: ${action.slice(0, 2000)}` },
    ],
  })

  const raw = completion.choices[0]?.message?.content ?? '{}'
  return JSON.parse(raw) as VerifyAssessment
}
