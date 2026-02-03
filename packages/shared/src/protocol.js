import { z } from 'zod';

export const BaseMessage = z.object({
  type: z.string(),
  sessionId: z.string(),
  participantId: z.string(),
  deviceId: z.string(),
  timestamp: z.number()
});

export const TranscriptChunk = BaseMessage.extend({
  type: z.literal('transcript_chunk'),
  seq: z.number().int().nonnegative(),
  text: z.string(),
  isFinal: z.boolean().default(false),
  language: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  origin: z.string().optional()
});

export const FinalTranscript = BaseMessage.extend({
  type: z.literal('final_transcript'),
  seq: z.number().int().nonnegative(),
  text: z.string(),
  language: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  origin: z.string().optional(),
  span: z
    .object({
      startMs: z.number().nonnegative(),
      endMs: z.number().nonnegative()
    })
    .optional()
});

export const ParticipantUpdate = BaseMessage.extend({
  type: z.literal('participant_update'),
  displayName: z.string().optional(),
  role: z.string().optional(),
  labels: z.array(z.string()).optional()
});

export const ContextUpdate = BaseMessage.extend({
  type: z.literal('context_update'),
  relationships: z
    .array(
      z.object({
        targetId: z.string(),
        kind: z.string(),
        weight: z.number().min(0).max(1).optional()
      })
    )
    .optional(),
  notes: z.string().optional()
});

export const Join = z.object({
  type: z.literal('join'),
  sessionId: z.string(),
  participantId: z.string(),
  deviceId: z.string(),
  deviceSecret: z.string()
});

export const Leave = z.object({
  type: z.literal('leave'),
  sessionId: z.string(),
  participantId: z.string(),
  deviceId: z.string(),
  timestamp: z.number()
});

export const Heartbeat = z.object({
  type: z.literal('heartbeat'),
  sessionId: z.string(),
  participantId: z.string(),
  deviceId: z.string(),
  timestamp: z.number(),
  rttMs: z.number().optional()
});

export const PartnerMessage = z.discriminatedUnion('type', [
  TranscriptChunk,
  FinalTranscript,
  ParticipantUpdate,
  ContextUpdate,
  Leave,
  Heartbeat
]);
