import { tailFile } from './tail';

export interface ApacheLogResult {
    service: string;
    logs: string;
}

export async function collectApacheLogs(): Promise<ApacheLogResult[]> {
    const apachePaths = [
        { service: 'apache-access', path: '/var/log/apache2/access.log' },
        { service: 'apache-error', path: '/var/log/apache2/error.log' },
        { service: 'apache-access', path: '/var/log/httpd/access_log' },
        { service: 'apache-error', path: '/var/log/httpd/error_log' }
    ];
    
    const results: ApacheLogResult[] = [];
    for (const item of apachePaths) {
        const logs = await tailFile(item.path);
        if (logs) {
            results.push({ service: item.service, logs });
        }
    }
    return results;
}
