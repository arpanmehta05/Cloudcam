import { NextResponse } from "next/server";

/**
 * Wraps an AWS API route handler, intercepting the AWS_NOT_CONNECTED error
 * and returning a structured 403 response the frontend can detect.
 */
export function notConnectedResponse() {
    return NextResponse.json(
        { success: false, notConnected: true, error: "AWS account not connected. Complete the setup at /settings/aws." },
        { status: 403 }
    );
}

export function isNotConnectedError(error: any): boolean {
    return error?.message === "AWS_NOT_CONNECTED";
}
