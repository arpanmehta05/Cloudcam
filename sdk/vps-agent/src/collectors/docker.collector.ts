import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function collectDockerLogs(since: string): Promise<{ container: string, logs: string }[]> {
    try {
        const { stdout: containers } = await execAsync("docker ps --format '{{.Names}}'");
        const names = containers.split('\n').filter(Boolean);
        const results = [];

        for (const name of names) {
            try {
                const { stdout: logs } = await execAsync(`docker logs --since ${since} ${name} 2>&1`);
                if (logs.trim()) {
                    results.push({ container: name, logs });
                }
            } catch (err: any) {
                console.warn(`[RabbittAgent] Warning: Failed to collect logs for docker container "${name}": ${err.message || err}`);
                continue;
            }
        }
        return results;
    } catch (err: any) {
        console.warn(`[RabbittAgent] Warning: Failed to list docker containers: ${err.message || err}`);
        return [];
    }
}
