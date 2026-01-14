/**
 * Input Validation Schemas
 *
 * Zod schemas for validating all client intents and messages.
 */

import { z } from 'zod';

/**
 * Metadata validation - limits size and structure
 */
const metadataSchema = z
  .record(z.unknown())
  .refine((obj) => JSON.stringify(obj).length < 10000, {
    message: 'Metadata too large (max 10KB)',
  })
  .optional();

/**
 * Join room intent validation
 */
export const joinRoomSchema = z.object({
  type: z.literal('join_room'),
  room: z
    .string()
    .min(1, 'Room name is required')
    .max(64, 'Room name too long (max 64 characters)')
    .regex(
      /^[a-zA-Z0-9\-_]+$/,
      'Room name can only contain alphanumeric characters, hyphens, and underscores'
    ),
  token: z.string().min(1, 'Token is required'),
  metadata: metadataSchema,
});

/**
 * Leave room intent validation
 */
export const leaveRoomSchema = z.object({
  type: z.literal('leave_room'),
});

/**
 * Start call intent validation
 */
export const startCallSchema = z.object({
  type: z.literal('start_call'),
  targetUserId: z.string().min(1, 'Target user ID is required'),
  metadata: metadataSchema,
});

/**
 * Accept call intent validation
 */
export const acceptCallSchema = z.object({
  type: z.literal('accept_call'),
  callId: z.string().min(1, 'Call ID is required'),
  metadata: metadataSchema,
});

/**
 * Reject call intent validation
 */
export const rejectCallSchema = z.object({
  type: z.literal('reject_call'),
  callId: z.string().min(1, 'Call ID is required'),
  reason: z.string().max(255, 'Reason too long (max 255 characters)').optional(),
});

/**
 * End call intent validation
 */
export const endCallSchema = z.object({
  type: z.literal('end_call'),
  callId: z.string().min(1, 'Call ID is required'),
  reason: z.string().max(255, 'Reason too long (max 255 characters)').optional(),
});

/**
 * Enable camera intent validation
 */
export const enableCameraSchema = z.object({
  type: z.literal('enable_camera'),
  deviceId: z.string().optional(),
});

/**
 * Disable camera intent validation
 */
export const disableCameraSchema = z.object({
  type: z.literal('disable_camera'),
});

/**
 * Enable microphone intent validation
 */
export const enableMicrophoneSchema = z.object({
  type: z.literal('enable_microphone'),
  deviceId: z.string().optional(),
});

/**
 * Disable microphone intent validation
 */
export const disableMicrophoneSchema = z.object({
  type: z.literal('disable_microphone'),
});

/**
 * Send data intent validation
 */
export const sendDataSchema = z
  .object({
    type: z.literal('send_data'),
    payload: z.unknown(),
    kind: z.enum(['reliable', 'lossy']).optional(),
  })
  .transform((data) => ({
    type: data.type as 'send_data',
    payload: data.payload,
    kind: data.kind,
  }));

/**
 * Subscribe to participant intent validation
 */
export const subscribeToParticipantSchema = z.object({
  type: z.literal('subscribe_to_participant'),
  participantSid: z.string().min(1, 'Participant SID is required'),
});

/**
 * Unsubscribe from participant intent validation
 */
export const unsubscribeFromParticipantSchema = z.object({
  type: z.literal('unsubscribe_from_participant'),
  participantSid: z.string().min(1, 'Participant SID is required'),
});

/**
 * Mute track intent validation
 */
export const muteTrackSchema = z.object({
  type: z.literal('mute_track'),
  trackSid: z.string().min(1, 'Track SID is required'),
});

/**
 * Unmute track intent validation
 */
export const unmuteTrackSchema = z.object({
  type: z.literal('unmute_track'),
  trackSid: z.string().min(1, 'Track SID is required'),
});

/**
 * Client intent validation schema (union)
 */
export const clientIntentSchema = z.union([
  joinRoomSchema,
  leaveRoomSchema,
  startCallSchema,
  acceptCallSchema,
  rejectCallSchema,
  endCallSchema,
  enableCameraSchema,
  disableCameraSchema,
  enableMicrophoneSchema,
  disableMicrophoneSchema,
  sendDataSchema,
  subscribeToParticipantSchema,
  unsubscribeFromParticipantSchema,
  muteTrackSchema,
  unmuteTrackSchema,
]);

/**
 * Validation result type
 */
export type ValidationResult<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: z.ZodError;
    };

/**
 * Validate a client intent
 */
export function validateClientIntent(
  data: unknown
): ValidationResult<z.infer<typeof clientIntentSchema>> {
  const result = clientIntentSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Format Zod error for client response
 */
export function formatZodError(error: z.ZodError): string {
  const issues = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
    return `${path}: ${issue.message}`;
  });
  return issues.join(', ');
}
