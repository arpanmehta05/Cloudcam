import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { SystemMetrics } from '../core/types';

const execAsync = promisify(exec);

export async function getSystemMetrics(): Promise<SystemMetrics> {
    const timestamp = new Date().toISOString();
    
    // CPU Usage (simplified for cross-platform Node.js)
    const cpus = os.cpus();
    const load = os.loadavg();
    const cpuPercent = (load[0] / cpus.length) * 100;

    // RAM Usage
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const ramUsedMb = Math.round((totalMem - freeMem) / (1024 * 1024));
    const ramTotalMb = Math.round(totalMem / (1024 * 1024));

    // Disk Usage (platform specific, using df for linux/unix)
    let diskUsedPercent = 0;
    try {
        if (os.platform() !== 'win32') {
            const { stdout } = await execAsync("df -P / | awk 'NR==2 {print $5}'");
            diskUsedPercent = parseInt(stdout.replace('%', ''), 10);
        }
    } catch (err) {
        console.warn('Failed to fetch disk metrics:', err);
    }

    return {
        cpuPercent: parseFloat(cpuPercent.toFixed(2)),
        ramUsedMb,
        ramTotalMb,
        diskUsedPercent,
        timestamp
    };
}
