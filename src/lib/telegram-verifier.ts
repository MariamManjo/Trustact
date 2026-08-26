import TelegramBot from 'node-telegram-bot-api'
import { randomUUID } from 'crypto'
import type { PaymentResult } from './solana-pay'
import { registerVerifierWallet, isValidSolanaAddress, getVerifierWallet } from './verifier-wallets'
import { VERIFICATION_WINDOW_SECONDS } from './verification-window'

type VerifierAnswer = 'yes' | 'no'
type PendingState = 'pending' | VerifierAnswer

export interface VerifierIdentity {
  telegramUserId: number
  username?: string
  firstName?: string
  answeredWithinHalfWindow: boolean
}

interface GlobalWithBot {
  __trustsaurBot?: TelegramBot
  __trustsaurPending?: Map<string, PendingState>
  __trustsaurPayments?: Map<string, PaymentResult>
  __trustsaurWinners?: Map<string, VerifierIdentity>
  __trustsaurRequestedAt?: Map<string, number>
}

const g = globalThis as unknown as GlobalWithBot

function displayName(identity: VerifierIdentity): string {
  return identity.username ? `@${identity.username}` : identity.firstName || 'a verifier'
}

function getBot(): TelegramBot | null {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return null

  if (!g.__trustsaurBot) {
    g.__trustsaurBot = new TelegramBot(token, { polling: true })
    g.__trustsaurPending = new Map()
    g.__trustsaurWinners = new Map()
    g.__trustsaurRequestedAt = new Map()

    g.__trustsaurBot.on('polling_error', (err) => {
      console.error('Telegram polling error:', err.message)
    })

    g.__trustsaurBot.onText(/^\/register(?:\s+(.+))?$/, async (msg, match) => {
      const address = match?.[1]?.trim()
      const chatId = msg.chat.id

      if (!address) {
        g.__trustsaurBot?.sendMessage(
          chatId,
          'Register the wallet you want paid to when you verify something:\n\n/register <your Solana address>'
        )
        return
      }

      if (!isValidSolanaAddress(address)) {
        g.__trustsaurBot?.sendMessage(chatId, "That doesn't look like a valid Solana address — try again.")
        return
      }

      await registerVerifierWallet(msg.from!.id, address)
      g.__trustsaurBot?.sendMessage(
        chatId,
        `✅ Registered. Future verification payouts go to:\n${address}`
      )
    })

    g.__trustsaurBot.onText(/^\/mywallet$/, async (msg) => {
      const wallet = await getVerifierWallet(msg.from!.id)
      g.__trustsaurBot?.sendMessage(
        msg.chat.id,
        wallet
          ? `Registered wallet:\n${wallet}`
          : "No wallet registered yet. Use /register <your Solana address>."
      )
    })

    // Multiple verifiers can see the same message (a group chat). Only the
    // FIRST tap on a given request should count — everyone after that gets
    // told it's already resolved, and the message updates to show the winner.
    g.__trustsaurBot.on('callback_query', (query: TelegramBot.CallbackQuery) => {
      const data = query.data
      if (!data) return

      const requestId = data.split(':')[0]
      const currentStatus = g.__trustsaurPending?.get(requestId)
      if (currentStatus === undefined) return // unknown request

      if (currentStatus !== 'pending') {
        const winner = g.__trustsaurWinners?.get(requestId)
        g.__trustsaurBot?.answerCallbackQuery(query.id, {
          text: winner
            ? `Already answered by ${displayName(winner)}.`
            : 'Already answered.',
        })
        return
      }

      const answer: VerifierAnswer = data.endsWith(':yes') ? 'yes' : 'no'

      // Second line of defense against a race between two near-simultaneous
      // taps: re-check status right before committing, first writer wins.
      if (g.__trustsaurPending?.get(requestId) !== 'pending') {
        g.__trustsaurBot?.answerCallbackQuery(query.id, { text: 'Already answered.' })
        return
      }
      g.__trustsaurPending?.set(requestId, answer)

      const requestedAt = g.__trustsaurRequestedAt?.get(requestId)
      const answeredWithinHalfWindow = requestedAt
        ? Date.now() - requestedAt <= (VERIFICATION_WINDOW_SECONDS * 1000) / 2
        : false

      const identity: VerifierIdentity = {
        telegramUserId: query.from.id,
        username: query.from.username,
        firstName: query.from.first_name,
        answeredWithinHalfWindow,
      }
      g.__trustsaurWinners?.set(requestId, identity)

      g.__trustsaurBot?.answerCallbackQuery(query.id, {
        text: answer === 'yes' ? 'Thanks — sent!' : 'Got it — declined.',
      })

      const originalText = query.message && 'text' in query.message ? query.message.text : undefined
      if (query.message && originalText) {
        const who = displayName(identity)
        g.__trustsaurBot?.editMessageText(
          `${originalText}\n\n${answer === 'yes' ? `✅ ${who} confirmed: Yes` : `❌ ${who} confirmed: No`}`,
          {
            chat_id: query.message.chat.id,
            message_id: query.message.message_id,
          }
        )
      }
    })
  }

  return g.__trustsaurBot
}

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID)
}

export async function askVerifier(question: string): Promise<string> {
  const bot = getBot()
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!bot || !chatId) {
    throw new Error('Telegram is not configured (missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID).')
  }

  const requestId = randomUUID()
  g.__trustsaurPending?.set(requestId, 'pending')
  g.__trustsaurRequestedAt?.set(requestId, Date.now())

  await bot.sendMessage(chatId, `🦖 TrustSaur needs a quick check — first to answer wins:\n\n${question}`, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Yes', callback_data: `${requestId}:yes` },
          { text: '❌ No', callback_data: `${requestId}:no` },
        ],
      ],
    },
  })

  return requestId
}

export function getVerifierStatus(requestId: string): PendingState | 'unknown' {
  return g.__trustsaurPending?.get(requestId) ?? 'unknown'
}

export function getVerifierWinner(requestId: string): VerifierIdentity | undefined {
  return g.__trustsaurWinners?.get(requestId)
}

/** The winning verifier's own registered payout wallet, if they've set one. */
export async function getVerifierWinnerWallet(requestId: string): Promise<string | undefined> {
  const winner = g.__trustsaurWinners?.get(requestId)
  return winner ? getVerifierWallet(winner.telegramUserId) : undefined
}

export function getCachedPayment(requestId: string): PaymentResult | undefined {
  return g.__trustsaurPayments?.get(requestId)
}

export function setCachedPayment(requestId: string, result: PaymentResult) {
  if (!g.__trustsaurPayments) g.__trustsaurPayments = new Map()
  g.__trustsaurPayments.set(requestId, result)
}
