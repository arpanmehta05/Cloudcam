import fs from 'fs';
import path from 'path';
import { LogPayload } from './types';

const BUFFER_FILE = path.join(process.cwd(), '.rabbitt-buffer.json');

export class LogBuffer {
    static bufferLocally(payload: LogPayload) {
        try {
            let buffer: LogPayload[] = [];
            if (fs.existsSync(BUFFER_FILE)) {
                buffer = JSON.parse(fs.readFileSync(BUFFER_FILE, 'utf8'));
            }
            buffer.push(payload);
            // Limit buffer size to 500 entries
            if (buffer.length > 500) buffer.shift();
            fs.writeFileSync(BUFFER_FILE, JSON.stringify(buffer));
        } catch (err) {
            console.error('[LogBuffer] Critical: Failed to buffer logs', err);
        }
    }

    static getBuffered(): LogPayload[] {
        if (!fs.existsSync(BUFFER_FILE)) return [];
        try {
            return JSON.parse(fs.readFileSync(BUFFER_FILE, 'utf8'));
        } catch {
            return [];
        }
    }

    static writeBuffer(remaining: LogPayload[]) {
        try {
            fs.writeFileSync(BUFFER_FILE, JSON.stringify(remaining));
        } catch (err) {
            console.error('[LogBuffer] Failed to write remaining buffer', err);
        }
    }

    static exists(): boolean {
        return fs.existsSync(BUFFER_FILE);
    }
}
