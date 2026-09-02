import { randomBytes } from 'node:crypto';
import {
  createRoom,
  closeRoom,
  joinRoom,
  resignPlayer,
  startRoom,
  type CreateRoomInput,
  type RoomSession
} from './room-session.js';

export class RoomStore {
  private readonly rooms = new Map<string, RoomSession>();

  create(input: Omit<CreateRoomInput, 'code' | 'inviteToken'>): RoomSession {
    const code = this.createUniqueCode();
    const room = createRoom({ ...input, code, inviteToken: randomBytes(16).toString('hex') });
    this.rooms.set(code, room);
    return room;
  }

  get(code: string): RoomSession | undefined {
    return this.rooms.get(code);
  }

  join(
    code: string,
    participant: { id: string; nickname: string; inviteToken: string }
  ): RoomSession | undefined {
    const room = this.rooms.get(code);
    if (!room) {
      return undefined;
    }

    if (participant.inviteToken !== room.inviteToken) {
      throw new Error('The room invite token is invalid.');
    }

    const updated = joinRoom(room, participant);
    this.rooms.set(code, updated);
    return updated;
  }

  start(code: string, playerId: string): RoomSession | undefined {
    const room = this.rooms.get(code);
    if (!room) {
      return undefined;
    }

    const updated = startRoom(room, playerId);
    this.rooms.set(code, updated);
    return updated;
  }

  close(code: string, playerId: string): RoomSession | undefined {
    const room = this.rooms.get(code);
    if (!room) {
      return undefined;
    }

    const closed = closeRoom(room, playerId);
    this.rooms.delete(code);
    return closed;
  }

  resign(playerId: string): RoomSession | undefined {
    for (const [code, room] of this.rooms) {
      if (!room.players.some((player) => player.id === playerId)) {
        continue;
      }

      const updated = resignPlayer(room, playerId);
      this.rooms.set(code, updated);
      return updated;
    }

    return undefined;
  }

  private createUniqueCode(): string {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = randomBytes(4).toString('hex').toUpperCase();
      if (!this.rooms.has(code)) {
        return code;
      }
    }

    throw new Error('Could not allocate a room code.');
  }
}
