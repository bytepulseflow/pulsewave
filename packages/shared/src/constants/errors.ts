/**
 * Error messages
 */

import { ErrorCode } from '../types/room.types';

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.Unknown]: 'An unknown error occurred',
  [ErrorCode.InvalidRequest]: 'Invalid request',
  [ErrorCode.Unauthorized]: 'Unauthorized access',
  [ErrorCode.NotFound]: 'Resource not found',
  [ErrorCode.RoomNotFound]: 'Room not found',
  [ErrorCode.RoomFull]: 'Room is full',
  [ErrorCode.RoomClosed]: 'Room is closed',
  [ErrorCode.ParticipantNotFound]: 'Participant not found',
  [ErrorCode.ParticipantAlreadyJoined]: 'Participant already joined',
  [ErrorCode.TrackNotFound]: 'Track not found',
  [ErrorCode.TrackPublishError]: 'Failed to publish track',
  [ErrorCode.TrackSubscribeError]: 'Failed to subscribe to track',
  [ErrorCode.TransportError]: 'Transport error',
  [ErrorCode.MediaError]: 'Media error',
  [ErrorCode.DeviceNotFound]: 'Media device not found',
  [ErrorCode.PermissionDenied]: 'Permission denied',
  [ErrorCode.CallNotFound]: 'Call not found',
  [ErrorCode.CallAlreadyExists]: 'Call already exists',
  [ErrorCode.InvalidCallState]: 'Invalid call state',
};

/**
 * Get error message for error code
 */
export function getErrorMessage(code: ErrorCode): string {
  return ERROR_MESSAGES[code] || ERROR_MESSAGES[ErrorCode.Unknown];
}
