import { ResizeMigrationScopeLock } from "../../../types/resize-migration.types";

export const RESIZE_MIGRATION_SCOPE_LOCK: ResizeMigrationScopeLock = {
    feature: "resize_migration",
    phase: 0,
    lockedAt: "2026-05-26",
    mvpProvider: "aws",
    mvpComputeKind: "aws_ec2",
    mvpMode: "clone_and_cutover",
    sourceDeletionPolicy: "preserve_source_never_delete_in_mvp",
    applicationGuarantee: "cloud_level_only_no_full_app_level_guarantee",
    supportedCutoverModes: ["elastic_ip", "dns", "manual"],
    providers: [
        {
            provider: "aws",
            computeKind: "aws_ec2",
            status: "mvp",
            notes: [
                "AWS EC2 is the first implementation target.",
                "The MVP clones from an image, launches a target EC2 instance, validates cloud-level health, and waits for cutover approval.",
            ],
        },
        {
            provider: "azure",
            computeKind: "azure_vm",
            status: "mvp",
            notes: [
                "Azure VM support is fully implemented using the same clone-and-cutover workflow.",
                "Supports OS disk snapshot copying, target VM launching, validation, and cutover IP reassociation.",
            ],
        },
    ],
    modes: [
        {
            mode: "clone_and_cutover",
            status: "mvp",
            notes: [
                "Create a new target server from the source server image or disk state.",
                "Perform final cutover only after explicit user approval.",
            ],
        },
        {
            mode: "in_place_resize",
            status: "later",
            notes: ["Deferred until the clone-and-cutover workflow is stable."],
        },
        {
            mode: "assisted_live_sync",
            status: "later",
            notes: ["Deferred until the cloud-level MVP is complete."],
        },
    ],
    nonGoals: [
        "Do not delete the source server in the MVP.",
        "Do not promise zero downtime in the MVP.",
        "Do not promise full application-level migration or automatic app repair.",
        "Do not migrate external databases, caches, third-party APIs, or app-specific dependencies automatically.",
        "Do not start with GCP support.",
    ],
    nextPhase: {
        phase: 1,
        title: "Backend Job And Task Model",
        expectedWork: [
            "Add migration job model.",
            "Add migration task model.",
            "Add migration status transitions.",
            "Add basic job creation and retrieval APIs.",
        ],
    },
};

export function getResizeMigrationScopeLock(): ResizeMigrationScopeLock {
    return RESIZE_MIGRATION_SCOPE_LOCK;
}
