/**
 * ParticipantStore - Manages participant state and registry
 *
 * Handles storage and retrieval of local and remote participants.
 * Provides intent-based methods for track management.
 */

import type { RemoteParticipant, RemoteTrackPublication } from '../../types';
import { LocalParticipantImpl } from '../LocalParticipant';
import { RemoteParticipantImpl } from '../Participant';
import { LocalTrackPublicationImpl } from '../TrackPublication';

/**
 * ParticipantStore - Manages participant state
 */
export class ParticipantStore {
  private localParticipant: LocalParticipantImpl | null = null;
  private participants: Map<string, RemoteParticipantImpl> = new Map();

  /**
   * Set local participant
   */
  setLocalParticipant(participant: LocalParticipantImpl): void {
    this.localParticipant = participant;
  }

  /**
   * Get local participant
   */
  getLocalParticipant(): LocalParticipantImpl | null {
    return this.localParticipant;
  }

  /**
   * Add local track publication to local participant
   * Intent-based method - encapsulates track management
   */
  addLocalTrack(publication: LocalTrackPublicationImpl): void {
    if (!this.localParticipant) {
      throw new Error('Local participant not set');
    }
    this.localParticipant.tracks.set(publication.sid, publication);

    // Emit track-published event to trigger React re-renders
    (this.localParticipant as unknown as { emit: (event: string, data: unknown) => void }).emit(
      'track-published',
      publication
    );
  }

  /**
   * Remove local track publication by producer ID
   * Intent-based method - encapsulates track management
   */
  removeLocalTrackByProducerId(producerId: string): LocalTrackPublicationImpl | null {
    if (!this.localParticipant) {
      return null;
    }

    for (const [sid, publication] of this.localParticipant.tracks.entries()) {
      if (sid === producerId) {
        this.localParticipant.tracks.delete(sid);

        // Emit track-unpublished event to trigger React re-renders
        (this.localParticipant as unknown as { emit: (event: string, data: unknown) => void }).emit(
          'track-unpublished',
          publication
        );

        return publication;
      }
    }
    return null;
  }

  /**
   * Get local track publication by producer ID
   */
  getLocalTrackByProducerId(producerId: string): LocalTrackPublicationImpl | null {
    if (!this.localParticipant) {
      return null;
    }

    return this.localParticipant.tracks.get(producerId) ?? null;
  }

  /**
   * Add remote participant
   */
  addParticipant(participant: RemoteParticipantImpl): void {
    this.participants.set(participant.sid, participant);
  }

  /**
   * Remove remote participant
   */
  removeParticipant(sid: string): RemoteParticipantImpl | null {
    const participant = this.participants.get(sid);
    if (participant) {
      participant.removeAllListeners();
      this.participants.delete(sid);
    }
    return participant ?? null;
  }

  /**
   * Get remote participant by SID
   */
  getParticipant(sid: string): RemoteParticipant | null {
    return this.participants.get(sid) ?? null;
  }

  /**
   * Get remote participant by identity
   */
  getParticipantByIdentity(identity: string): RemoteParticipant | null {
    for (const participant of this.participants.values()) {
      if (participant.identity === identity) {
        return participant;
      }
    }
    return null;
  }

  /**
   * Get all remote participants
   */
  getParticipants(): RemoteParticipant[] {
    return Array.from(this.participants.values());
  }

  /**
   * Get participant count
   */
  getParticipantCount(): number {
    return this.participants.size;
  }

  /**
   * Clear all participants
   */
  clear(): void {
    this.participants.forEach((participant) => participant.removeAllListeners());
    this.participants.clear();
    if (this.localParticipant) {
      this.localParticipant.removeAllListeners();
      this.localParticipant = null;
    }
  }

  /**
   * Find track publication by SID across all participants
   */
  findTrackPublication(sid: string): RemoteTrackPublication | null {
    for (const participant of this.participants.values()) {
      const publication = participant.getTrack(sid);
      if (publication) {
        return publication;
      }
    }
    return null;
  }

  /**
   * Get participant that owns a track publication
   */
  getParticipantFromPublication(publication: RemoteTrackPublication): RemoteParticipant | null {
    for (const participant of this.participants.values()) {
      if (participant.getTrack(publication.sid)) {
        return participant;
      }
    }
    return null;
  }

  /**
   * Check if participant exists
   */
  hasParticipant(sid: string): boolean {
    return this.participants.has(sid);
  }

  /**
   * Get all participant SIDs
   */
  getParticipantSids(): string[] {
    return Array.from(this.participants.keys());
  }
}
