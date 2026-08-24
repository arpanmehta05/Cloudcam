import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execAsync = promisify(exec);

export async function tailFile(filePath: string, lines = 100): Promise<string> {
    if (!fs.existsSync(filePath)) {
        return "";
    }
    try {
        const { stdout } = await execAsync(`tail -n ${lines} ${filePath}`);
        return stdout;
    } catch (err: any) {
        console.warn(`[RabbittAgent] Warning: Failed to tail log file "${filePath}": ${err.message || err}`);
        return "";
    }
}
