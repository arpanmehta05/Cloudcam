import { tailFile } from './tail';

export async function collectNginxLogs(): Promise<{ access: string; error: string }> {
    const access = await tailFile('/var/log/nginx/access.log');
    const error = await tailFile('/var/log/nginx/error.log');
    return { access, error };
}
