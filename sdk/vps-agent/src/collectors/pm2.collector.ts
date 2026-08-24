import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function collectPm2Logs(): Promise<string> {
    try {
        const { stdout: logs } = await execAsync("pm2 logs --nostream --lines 100 2>/dev/null");
        const stripPm2Prefix = (line: string) => line.replace(/^\d+\|[^|]+\s+\|\s?/, "");

        const isPm2Noise = (line: string): boolean => {
            const stripped = stripPm2Prefix(line);
            if (/\[PM2\]|Spawning PM2 daemon|PM2 Successfully daemonized|Tailing last 100 lines|last 100 lines:/i.test(stripped)) {
                return true;
            }
            if (/PM2\s+\||PM2 log:/i.test(line)) {
                return true;
            }
            if (/[\\\/_]{5,}/.test(stripped)) {
                return true;
            }
            if (/^[\\\/\s_|\-\/\\=]+$/.test(stripped) && (stripped.includes('/') || stripped.includes('\\'))) {
                return true;
            }
            return false;
        };

        return logs
            .split(/\r?\n/)
            .filter(Boolean)
            .filter((line) => !isPm2Noise(line))
            .join("\n");
    } catch (err: any) {
        console.warn(`[RabbittAgent] Warning: Failed to collect PM2 logs: ${err.message || err}`);
        return "";
    }
}
