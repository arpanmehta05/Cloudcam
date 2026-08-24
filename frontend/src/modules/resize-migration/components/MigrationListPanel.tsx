import React from "react";
import { Button } from "@/components/ui/button";
import { Zap } from "@/icons";
import { CreateMigrationSheet } from "./CreateMigrationSheet";
import { DeleteMigrationDialog } from "./DeleteMigrationDialog";
import { MigrationJobList } from "./MigrationJobList";
import { MigrationListPanelProps } from "./MigrationListPanel.types";

export function MigrationListPanel(props: MigrationListPanelProps) {
  const { jobs, setIsCreateOpen } = props;

  return (
    <div className="mx-auto max-w-[min(1600px,calc(100vw-2rem))] space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#020617] dark:text-white">
            Resize Migrations
          </h1>
          <p className="text-sm text-slate-500 font-semibold mt-1">
            Clone cloud instances, copy configurations, track timelines, and
            cut over when ready.
          </p>
        </div>
        <Button
          onClick={() => setIsCreateOpen(true)}
          className="bg-[#2563eb] text-white hover:bg-blue-700 font-extrabold text-[13px] h-10 shadow-lg shadow-blue-500/20"
        >
          <Zap className="h-4 w-4 mr-2" /> New Migration
        </Button>
      </header>

      <MigrationJobList
        jobs={jobs}
        filteredJobs={props.filteredJobs}
        filterTab={props.filterTab}
        setFilterTab={props.setFilterTab}
        isLoadingList={props.isLoadingList}
        setIsCreateOpen={setIsCreateOpen}
        handleOpenJob={props.handleOpenJob}
        handleDeleteJob={props.handleDeleteJob}
      />

      <CreateMigrationSheet
        isCreateOpen={props.isCreateOpen}
        setIsCreateOpen={setIsCreateOpen}
        provider={props.provider}
        setProvider={props.setProvider}
        region={props.region}
        setRegion={props.setRegion}
        sources={props.sources}
        isLoadingSources={props.isLoadingSources}
        selectedSourceId={props.selectedSourceId}
        setSelectedSourceId={props.setSelectedSourceId}
        targetSizes={props.targetSizes}
        isLoadingTargetSizes={props.isLoadingTargetSizes}
        selectedTargetType={props.selectedTargetType}
        setSelectedTargetType={props.setSelectedTargetType}
        cutoverMode={props.cutoverMode}
        setCutoverMode={props.setCutoverMode}
        dnsHostedZoneId={props.dnsHostedZoneId}
        setDnsHostedZoneId={props.setDnsHostedZoneId}
        dnsZoneName={props.dnsZoneName}
        setDnsZoneName={props.setDnsZoneName}
        dnsResourceGroupName={props.dnsResourceGroupName}
        setDnsResourceGroupName={props.setDnsResourceGroupName}
        dnsDomainName={props.dnsDomainName}
        setDnsDomainName={props.setDnsDomainName}
        dnsRecordType={props.dnsRecordType}
        setDnsRecordType={props.setDnsRecordType}
        dnsTtl={props.dnsTtl}
        setDnsTtl={props.setDnsTtl}
        isScheduled={props.isScheduled}
        setIsScheduled={props.setIsScheduled}
        scheduledTime={props.scheduledTime}
        setScheduledTime={props.setScheduledTime}
        accessMode={props.accessMode}
        setAccessMode={props.setAccessMode}
        accessMethod={props.accessMethod}
        setAccessMethod={props.setAccessMethod}
        sshUsername={props.sshUsername}
        setSshUsername={props.setSshUsername}
        sshPort={props.sshPort}
        setSshPort={props.setSshPort}
        sshKey={props.sshKey}
        setSshKey={props.setSshKey}
        activeRegions={props.activeRegions}
        filteredSources={props.filteredSources}
        handleCreateJob={props.handleCreateJob}
        getRegionLabel={props.getRegionLabel}
      />

      <DeleteMigrationDialog
        deleteConfirmJobId={props.deleteConfirmJobId}
        setDeleteConfirmJobId={props.setDeleteConfirmJobId}
        isDeleting={props.isDeleting}
        handleConfirmDelete={props.handleConfirmDelete}
      />
    </div>
  );
}
