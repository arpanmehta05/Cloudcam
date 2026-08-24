export const ACTION_EXECUTION_EVENT = "rabbittwatch:action-execution";

export interface ActionExecutionEventDetail {
    actionRequestId?: string;
    actionId?: string;
    status?: string;
    message?: string;
    source?: string;
}

export function emitActionExecutionEvent(detail: ActionExecutionEventDetail): void {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent<ActionExecutionEventDetail>(ACTION_EXECUTION_EVENT, { detail }));
}
